import { Container, Graphics, Text } from 'pixi.js';
import { createApp } from './render/app';
import { Camera } from './render/camera';
import { loadBlockAtlas } from './render/texture-atlas';
import { ChunkStreamer, streamRadiusForViewport } from './render/chunk-streamer';
import { drawBreakingOverlay } from './render/breaking-overlay';
import { PlayerView } from './render/player-view';
import { loadUiTextures } from './render/ui-assets';
import { createBlockRegistry, AIR } from './blocks/registry';
import { World } from './world/world';
import { TerrainGenerator, SEA_LEVEL } from './gen/terrain';
import { canBreak, canPlace, withinReach } from './world/interaction';
import { stepMining, type MiningState } from './world/mining';
import { Player } from './entity/player';
import { stepPhysics } from './entity/physics';
import { Keyboard } from './input/keyboard';
import { Mouse } from './input/mouse';
import { GameLoop } from './core/loop';
import { TICK_RATE, WORLD_HEIGHT } from './core/constants';
import { Inventory } from './ui/inventory';
import { HotbarView } from './ui/hotbar-view';
import { InventoryView } from './ui/inventory-view';
import type { CraftingRecipe } from './ui/crafting';
import { deserializeGame, serializeGame } from './storage/save-data';
import { loadSavedGame, openSaveDatabase, saveGame } from './storage/indexed-db';
import {
  MAX_HEALTH,
  MAX_HUNGER,
  createSurvivalState,
  dayPhaseLabel,
  nightOverlayAlpha,
  stepSurvival,
} from './survival/survival';

/** Minimum chunks kept on each side of the player, even in narrow windows. */
const MIN_STREAM_RADIUS = 4;
/** Extra chunks beyond the visible viewport to preload before the camera reaches them. */
const STREAM_MARGIN_CHUNKS = 2;

/**
 * M3: break blocks (left-click) and place the selected block (right-click),
 * both limited to REACH blocks from the player. Edits update the world and its
 * chunk view live.
 */
async function main(): Promise<void> {
  const app = await createApp();
  const registry = createBlockRegistry();
  await loadUiTextures();
  const atlas = await loadBlockAtlas(registry.textureKeys());

  let saveDb: IDBDatabase | null = null;
  let saveStatus = 'save: starting';
  let loadedGame: ReturnType<typeof deserializeGame> | null = null;
  try {
    saveDb = await openSaveDatabase();
    const saved = await loadSavedGame(saveDb);
    if (saved) {
      loadedGame = deserializeGame(saved);
      saveStatus = `save: loaded ${loadedGame.chunks.length} chunks`;
    } else {
      saveStatus = 'save: new world';
    }
  } catch (err) {
    saveStatus = 'save: unavailable';
    console.warn('[save] IndexedDB load failed; continuing without persistence', err);
  }

  const seed = loadedGame?.seed ?? (Math.random() * 0x100000000) >>> 0;
  const generator = new TerrainGenerator(seed, registry);
  const world = new World(registry, generator);
  for (const chunk of loadedGame?.chunks ?? []) world.setChunk(chunk);
  const inventory = new Inventory();
  const craftingRecipes = createCraftingRecipes(registry);
  let survival = createSurvivalState();

  const camera = new Camera(32);

  // Rendered world (block units); the camera scales it to pixels.
  const worldView = new Container();
  const terrainView = new Container();
  worldView.addChild(terrainView);
  const chunkStreamer = new ChunkStreamer(terrainView, world, registry, atlas);

  const player = new Player();
  const spawnX = findLandColumn(generator);
  player.x = spawnX + 0.5;
  player.y = generator.surfaceHeight(spawnX); // feet on the surface block
  player.savePrev();
  const initialViewport = viewportSize(app.canvas);
  chunkStreamer.syncAround(
    player.x,
    streamRadiusForViewport(
      initialViewport.width,
      camera.pixelsPerBlock,
      MIN_STREAM_RADIUS,
      STREAM_MARGIN_CHUNKS,
    ),
  );

  let saveTimer: number | null = null;
  const saveNow = async (): Promise<void> => {
    if (!saveDb) return;
    saveStatus = 'save: saving';
    try {
      await saveGame(saveDb, serializeGame(seed, world.cachedChunks()));
      saveStatus = `save: saved ${world.cachedChunkXs().length} chunks`;
    } catch (err) {
      saveStatus = 'save: error';
      console.warn('[save] IndexedDB save failed', err);
    }
  };
  const queueSave = (): void => {
    if (!saveDb) return;
    saveStatus = 'save: queued';
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = null;
      void saveNow();
    }, 500);
  };
  window.addEventListener('pagehide', () => {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    void saveNow();
  });
  queueSave();

  const breakingOverlay = new Graphics();
  breakingOverlay.visible = false;
  worldView.addChild(breakingOverlay);

  const playerView = new PlayerView();
  worldView.addChild(playerView.container);

  // Target-cell outline (drawn on top of everything in the world).
  const highlight = new Graphics();
  highlight.rect(0, 0, 1, 1).stroke({ width: 0.06, color: 0xffffff, alignment: 0.5 });
  highlight.visible = false;
  worldView.addChild(highlight);

  app.stage.addChild(worldView);

  const nightOverlay = new Graphics();
  app.stage.addChild(nightOverlay);

  const keyboard = new Keyboard();
  const mouse = new Mouse(app.canvas);

  const hud = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 14 },
  });
  hud.position.set(8, 8);
  app.stage.addChild(hud);

  const hotbarView = new HotbarView(inventory, registry, atlas);
  app.stage.addChild(hotbarView.container);

  const inventoryView = new InventoryView(inventory, registry, atlas, craftingRecipes);
  app.stage.addChild(inventoryView.container);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !e.repeat) {
      e.preventDefault();
      inventoryView.toggle();
      return;
    }
    if (e.code === 'Escape' && inventoryView.isOpen) {
      e.preventDefault();
      inventoryView.setOpen(false);
      return;
    }

    const m = /^Digit([1-9])$/.exec(e.code);
    if (m && !inventoryView.isOpen) inventory.select(Number(m[1]) - 1);
  });

  const isSolid = (bx: number, by: number): boolean => world.isSolid(bx, by);

  // Current mouse target, recomputed each tick for rendering the highlight.
  let target: { bx: number; by: number; inReach: boolean } | null = null;
  let mining: MiningState | null = null;
  let walkPhase = 0;

  const loop = new GameLoop({
    update: (dt) => {
      player.savePrev();
      const moveInput =
        survival.alive && !inventoryView.isOpen
          ? keyboard.moveInput
          : { left: false, right: false, jump: false, sprint: false };
      const next = stepPhysics(player, Player.WIDTH, Player.HEIGHT, moveInput, dt, isSolid);
      player.x = next.x;
      player.y = next.y;
      player.vx = next.vx;
      player.vy = next.vy;
      player.grounded = next.grounded;
      if (player.grounded && Math.abs(player.vx) > 0.05) {
        walkPhase += dt * Math.abs(player.vx) * 4.5;
      }

      survival = stepSurvival(survival, {
        dt,
        y: player.y,
        vy: player.vy,
        grounded: player.grounded,
        moving: Math.abs(player.vx) > 0.01 || moveInput.jump,
      });

      const streamPlan = chunkStreamer.syncAround(
        player.x,
        streamRadiusForViewport(
          viewportSize(app.canvas).width,
          camera.pixelsPerBlock,
          MIN_STREAM_RADIUS,
          STREAM_MARGIN_CHUNKS,
        ),
      );
      if (streamPlan.toLoad.length > 0) queueSave();

      // Cycle selection with the wheel.
      const wheel = mouse.takeWheelSteps();
      if (wheel !== 0 && !inventoryView.isOpen) {
        inventory.cycleSelected(wheel);
      }

      // Resolve the targeted cell and handle break/place.
      const rightClick = mouse.takeRightClick();
      if (inventoryView.isOpen) {
        target = null;
        mining = null;
      } else if (mouse.hasPosition) {
        const wp = camera.screenToWorld(mouse.x, mouse.y);
        const bx = Math.floor(wp.x);
        const by = Math.floor(wp.y);
        const originX = player.x;
        const originY = player.y - Player.HEIGHT / 2; // reach from body center
        const inReach = withinReach(originX, originY, bx, by);
        const insideWorld = by >= 0 && by < WORLD_HEIGHT;
        target = { bx, by, inReach };

        const targetBlock = world.getBlock(bx, by);
        const targetDef = registry.byId(targetBlock);
        const dropId = targetDef.drops === null ? null : registry.idOf(targetDef.drops);
        const canMineTarget =
          insideWorld &&
          inReach &&
          canBreak(targetDef) &&
          (dropId === null || inventory.canAdd(dropId));
        const miningStep = stepMining(mining, {
          dt,
          mining: mouse.leftDown,
          target: canMineTarget ? { bx, by, blockId: targetBlock } : null,
          hardness: targetDef.hardness,
        });
        mining = miningStep.state;

        if (miningStep.completed) {
          world.setBlock(bx, by, AIR);
          chunkStreamer.updateBlock(bx, by);
          if (dropId !== null) inventory.add(dropId);
          mining = null;
          queueSave();
        }

        const selectedSlot = inventory.selectedSlot;
        if (!miningStep.completed && insideWorld && inReach && rightClick && selectedSlot) {
          const targetIsAir = world.getBlock(bx, by) === AIR;
          const selectedDef = registry.byId(selectedSlot.blockId);
          if (
            canPlace(
              targetIsAir,
              selectedDef.solid,
              bx,
              by,
              player.x,
              player.y,
              Player.WIDTH,
              Player.HEIGHT,
            )
          ) {
            const blockId = inventory.consumeSelected();
            if (blockId !== null) {
              world.setBlock(bx, by, blockId);
              chunkStreamer.updateBlock(bx, by);
              mining = null;
              queueSave();
            }
          }
        }
      } else {
        target = null;
        mining = null;
      }
    },
    render: (alpha) => {
      const rx = player.prevX + (player.x - player.prevX) * alpha;
      const ry = player.prevY + (player.y - player.prevY) * alpha;

      const viewport = viewportSize(app.canvas);
      camera.viewportWidth = viewport.width;
      camera.viewportHeight = viewport.height;
      const lookOffset = cameraLookOffset(mouse, viewport, inventoryView.isOpen);
      camera.x = rx + lookOffset.x;
      camera.y = ry - Player.HEIGHT / 2 + lookOffset.y;
      const aim = mouse.hasPosition
        ? camera.screenToWorld(mouse.x, mouse.y)
        : { x: rx + Math.sign(player.vx || 1) * 2, y: ry - Player.HEIGHT / 2 };
      playerView.update({
        x: rx,
        y: ry,
        vx: player.vx,
        vy: player.vy,
        grounded: player.grounded,
        walkPhase,
        aimX: aim.x,
        aimY: aim.y,
      });

      const origin = camera.worldToScreen(0, 0);
      worldView.position.set(origin.x, origin.y);
      worldView.scale.set(camera.pixelsPerBlock);
      drawBreakingOverlay(breakingOverlay, mining);

      const nightAlpha = nightOverlayAlpha(survival.dayTime);
      nightOverlay.clear().rect(0, 0, viewport.width, viewport.height).fill(0x06111f);
      nightOverlay.alpha = nightAlpha;
      nightOverlay.visible = nightAlpha > 0.01;

      hotbarView.layout(viewport.width, viewport.height);
      hotbarView.update();
      inventoryView.layout(viewport.width, viewport.height);
      if (mouse.hasPosition) inventoryView.setPointer(mouse.x, mouse.y);
      inventoryView.update();

      if (target) {
        highlight.visible = true;
        highlight.position.set(target.bx, target.by);
        highlight.tint = target.inReach ? 0x33ff33 : 0xff5555;
      } else {
        highlight.visible = false;
      }

      hud.text =
        `Minecraft 2D — post-M8: mining + skin UI (seed ${seed})\n` +
        `${saveStatus}\n` +
        `health: ${formatStat(survival.health)}/${MAX_HEALTH}  hunger: ${formatStat(survival.hunger)}/${MAX_HUNGER}  time: ${dayPhaseLabel(survival.dayTime)}\n` +
        `selected: ${selectedLabel(inventory, registry)}\n` +
        `slots: ${filledSlots(inventory)}/${inventory.size}  items: ${totalItems(inventory)}\n` +
        `pos (${player.x.toFixed(1)}, ${player.y.toFixed(1)})  chunk ${chunkStreamer.renderedChunkXs().join(',')}  grounded: ${player.grounded}  ${survival.alive ? 'alive' : 'dead'}  @${TICK_RATE}Hz`;
    },
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __game: unknown }).__game = {
      player,
      world,
      registry,
      camera,
      generator,
      chunkStreamer,
      inventory,
      inventoryView,
      playerView,
      saveNow,
      getSurvival: () => survival,
    };
  }

  loop.start();
}

/** Find a dry-land column near the origin to spawn on (avoid spawning in water). */
function findLandColumn(generator: TerrainGenerator): number {
  for (let bx = 0; bx < 256; bx++) {
    if (generator.surfaceHeight(bx) < SEA_LEVEL - 1) return bx;
  }
  return 0;
}

function createCraftingRecipes(registry: ReturnType<typeof createBlockRegistry>): CraftingRecipe[] {
  return [
    {
      ingredients: [registry.idOf('oak_log')],
      result: { blockId: registry.idOf('oak_planks'), count: 4 },
    },
  ];
}

function viewportSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  return {
    width: canvas.clientWidth || window.innerWidth,
    height: canvas.clientHeight || window.innerHeight,
  };
}

function cameraLookOffset(
  mouse: Mouse,
  viewport: { width: number; height: number },
  disabled: boolean,
): { x: number; y: number } {
  if (disabled || !mouse.hasPosition) return { x: 0, y: 0 };
  const nx = clamp((mouse.x - viewport.width / 2) / (viewport.width / 2), -1, 1);
  const ny = clamp((mouse.y - viewport.height / 2) / (viewport.height / 2), -1, 1);
  return { x: nx * 1.25, y: ny * 0.75 };
}

function selectedLabel(
  inventory: Inventory,
  registry: ReturnType<typeof createBlockRegistry>,
): string {
  const slot = inventory.selectedSlot;
  if (!slot) return `${inventory.selectedIndex + 1}. empty`;
  const def = registry.byId(slot.blockId);
  return `${inventory.selectedIndex + 1}. ${def.key} x${slot.count}`;
}

function filledSlots(inventory: Inventory): number {
  return inventory.snapshot().filter((slot) => slot !== null).length;
}

function totalItems(inventory: Inventory): number {
  return inventory.snapshot().reduce((total, slot) => total + (slot?.count ?? 0), 0);
}

function formatStat(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

void main();
