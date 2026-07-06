import { Container, Graphics, Text } from 'pixi.js';
import { createApp } from './render/app';
import { Camera } from './render/camera';
import { loadBlockAtlas } from './render/texture-atlas';
import { ChunkStreamer, streamRadiusForViewport } from './render/chunk-streamer';
import { drawBreakingOverlay } from './render/breaking-overlay';
import { ItemDropView } from './render/item-drop-view';
import { createBlockRegistry, AIR } from './blocks/registry';
import { World } from './world/world';
import { TerrainGenerator, SEA_LEVEL } from './gen/terrain';
import { canBreak, canPlace, withinReach } from './world/interaction';
import { stepMining, type MiningState } from './world/mining';
import {
  BlockEntityStore,
  blockEntityContents,
  createBlockEntity,
  createChestEntity,
  createFurnaceEntity,
  type BlockEntity,
} from './world/block-entities';
import { createSmeltingRecipes, stepFurnace } from './world/furnace';
import { Player } from './entity/player';
import { stepPhysics } from './entity/physics';
import { ItemDropManager, THROW_PICKUP_DELAY } from './entity/item-drop';
import { Keyboard } from './input/keyboard';
import { Mouse } from './input/mouse';
import { GameLoop } from './core/loop';
import { TICK_RATE, WORLD_HEIGHT } from './core/constants';
import { Inventory } from './ui/inventory';
import { HotbarView } from './ui/hotbar-view';
import { InventoryView, type ContainerScreen } from './ui/inventory-view';
import { createDefaultRecipes } from './ui/crafting';
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
/** Autosave interval while furnaces are burning (their state ticks nonstop). */
const FURNACE_SAVE_INTERVAL = 5;

async function main(): Promise<void> {
  const app = await createApp();
  const registry = createBlockRegistry();
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
  for (const [i, stack] of (loadedGame?.inventory ?? []).entries()) {
    if (i < inventory.size) inventory.setSlot(i, stack);
  }

  const blockEntities = new BlockEntityStore();
  for (const { bx, by, entity } of loadedGame?.blockEntities ?? []) {
    blockEntities.set(bx, by, entity);
  }

  const craftingRecipes = createDefaultRecipes(registry);
  const smeltingRecipes = createSmeltingRecipes(registry);
  const fuelSecondsOf = (blockId: number): number | null =>
    registry.byId(blockId).fuelSeconds ?? null;

  let survival = createSurvivalState();
  if (loadedGame?.player) {
    const p = loadedGame.player;
    survival = {
      ...survival,
      health: Math.min(MAX_HEALTH, Math.max(0, p.health)),
      hunger: Math.min(MAX_HUNGER, Math.max(0, p.hunger)),
      dayTime: p.dayTime,
      alive: p.health > 0,
    };
  }

  const camera = new Camera(32);

  // Rendered world (block units); the camera scales it to pixels.
  const worldView = new Container();
  const terrainView = new Container();
  worldView.addChild(terrainView);
  const chunkStreamer = new ChunkStreamer(terrainView, world, registry, atlas);

  const drops = new ItemDropManager();
  const dropView = new ItemDropView(registry, atlas);
  worldView.addChild(dropView.container);

  const player = new Player();
  const spawnX = findLandColumn(generator);
  const spawn = { x: spawnX + 0.5, y: generator.surfaceHeight(spawnX) };
  player.x = loadedGame?.player?.x ?? spawn.x;
  player.y = loadedGame?.player?.y ?? spawn.y;
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
      await saveGame(
        saveDb,
        serializeGame({
          seed,
          chunks: world.cachedChunks(),
          inventory: inventory.snapshot(),
          blockEntities: blockEntities.entries(),
          player: {
            x: player.x,
            y: player.y,
            health: survival.health,
            hunger: survival.hunger,
            dayTime: survival.dayTime,
          },
        }),
      );
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

  const playerSprite = createPlayerSprite();
  worldView.addChild(playerSprite);

  // Target-cell outline + breaking cracks (drawn on top of the world).
  const highlight = new Graphics();
  highlight.rect(0, 0, 1, 1).stroke({ width: 0.06, color: 0xffffff, alignment: 0.5 });
  highlight.visible = false;
  worldView.addChild(highlight);
  const breakingOverlay = new Graphics();
  breakingOverlay.visible = false;
  worldView.addChild(breakingOverlay);

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

  const dropFromPlayer = (stack: { blockId: number; count: number }): void => {
    const throwDir = mouse.hasPosition
      ? Math.sign(camera.screenToWorld(mouse.x, mouse.y).x - player.x) || 1
      : 1;
    drops.spawn(stack, player.x, player.y - Player.HEIGHT / 2, {
      vx: throwDir * 5,
      vy: -3,
      pickupDelay: THROW_PICKUP_DELAY,
    });
  };

  const inventoryView = new InventoryView(inventory, registry, atlas, craftingRecipes, {
    onChange: queueSave,
    onOverflow: dropFromPlayer,
  });
  app.stage.addChild(inventoryView.container);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE' && !e.repeat) {
      e.preventDefault();
      inventoryView.toggleInventory();
      return;
    }
    if (e.code === 'Escape' && inventoryView.isOpen) {
      e.preventDefault();
      inventoryView.close();
      return;
    }
    if (e.code === 'KeyQ' && !e.repeat && !inventoryView.isOpen && survival.alive) {
      const blockId = inventory.consumeSelected();
      if (blockId !== null) {
        dropFromPlayer({ blockId, count: 1 });
        queueSave();
      }
      return;
    }
    if (e.code === 'KeyR' && !e.repeat && !survival.alive) {
      // Respawn: fresh survival stats at the world spawn.
      survival = { ...createSurvivalState(), dayTime: survival.dayTime };
      player.x = spawn.x;
      player.y = spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.savePrev();
      return;
    }

    const m = /^Digit([1-9])$/.exec(e.code);
    if (m && !inventoryView.isOpen) inventory.select(Number(m[1]) - 1);
  });

  const isSolid = (bx: number, by: number): boolean => world.isSolid(bx, by);

  /** Open the UI for an interactive block, creating its entity lazily. */
  const openBlockScreen = (bx: number, by: number, interaction: string): void => {
    if (interaction === 'crafting_table') {
      inventoryView.open({ kind: 'crafting_table' });
      return;
    }
    let entity: BlockEntity | null = blockEntities.get(bx, by);
    if (!entity) {
      entity = interaction === 'chest' ? createChestEntity() : createFurnaceEntity();
      blockEntities.set(bx, by, entity);
    }
    const screen: ContainerScreen =
      entity.kind === 'chest' ? { kind: 'chest', entity } : { kind: 'furnace', entity };
    inventoryView.open(screen);
  };

  // Current mouse target, recomputed each tick for rendering the highlight.
  let target: { bx: number; by: number; inReach: boolean } | null = null;
  let miningState: MiningState | null = null;
  let furnaceSaveTimer = 0;

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

      // Ground item drops: physics + magnetic pickup near the body center.
      drops.step(dt, isSolid);
      if (survival.alive) {
        drops.collect(player.x, player.y - Player.HEIGHT / 2, (blockId, count) =>
          inventory.add(blockId, count),
        );
      }

      // Furnaces smelt in real time, whether their UI is open or not.
      let anyFurnaceActive = false;
      for (const { entity } of blockEntities.entries()) {
        if (entity.kind !== 'furnace') continue;
        if (stepFurnace(entity, dt, { recipes: smeltingRecipes, fuelSecondsOf })) {
          anyFurnaceActive = true;
        }
      }
      furnaceSaveTimer += dt;
      if (anyFurnaceActive && furnaceSaveTimer >= FURNACE_SAVE_INTERVAL) {
        furnaceSaveTimer = 0;
        queueSave();
      }

      // Cycle selection with the wheel.
      const wheel = mouse.takeWheelSteps();
      if (wheel !== 0 && !inventoryView.isOpen) {
        inventory.cycleSelected(wheel);
      }

      const rightClick = mouse.takeRightClick();
      mouse.takeLeftClick(); // consumed: breaking is hold-to-mine now

      if (inventoryView.isOpen || !mouse.hasPosition || !survival.alive) {
        target = null;
        miningState = null;
        return;
      }

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

      // Hold left mouse to mine (duration follows block hardness).
      const miningAllowed = insideWorld && inReach && canBreak(targetDef);
      const step = stepMining(miningState, {
        dt,
        mining: mouse.leftDown && miningAllowed,
        target: miningAllowed ? { bx, by, blockId: targetBlock } : null,
        hardness: targetDef.hardness,
      });
      miningState = step.state;
      if (step.completed) {
        miningState = null;
        world.setBlock(bx, by, AIR);
        chunkStreamer.updateBlock(bx, by);

        // Interactive blocks spill their stored items on break.
        const entity = blockEntities.get(bx, by);
        if (entity) {
          for (const stack of blockEntityContents(entity)) {
            drops.spawn(stack, bx + 0.5, by + 1);
          }
          blockEntities.remove(bx, by);
        }
        if (targetDef.drops !== null) {
          drops.spawn({ blockId: registry.idOf(targetDef.drops), count: 1 }, bx + 0.5, by + 1);
        }
        queueSave();
      }

      if (rightClick && insideWorld && inReach) {
        // Right-click a functional block: open its UI instead of placing.
        if (targetDef.interaction !== undefined) {
          openBlockScreen(bx, by, targetDef.interaction);
          target = null;
          miningState = null;
          return;
        }

        const selectedSlot = inventory.selectedSlot;
        if (selectedSlot) {
          const selectedDef = registry.byId(selectedSlot.blockId);
          const targetIsAir = targetBlock === AIR;
          if (
            selectedDef.item !== true &&
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
              if (selectedDef.interaction !== undefined) {
                const entity = createBlockEntity(selectedDef.interaction);
                if (entity) blockEntities.set(bx, by, entity);
              }
              queueSave();
            }
          }
        }
      }
    },
    render: (alpha) => {
      const rx = player.prevX + (player.x - player.prevX) * alpha;
      const ry = player.prevY + (player.y - player.prevY) * alpha;
      playerSprite.position.set(rx, ry);

      const viewport = viewportSize(app.canvas);
      camera.viewportWidth = viewport.width;
      camera.viewportHeight = viewport.height;
      camera.x = rx;
      camera.y = ry - Player.HEIGHT / 2;

      const origin = camera.worldToScreen(0, 0);
      worldView.position.set(origin.x, origin.y);
      worldView.scale.set(camera.pixelsPerBlock);

      dropView.sync(drops.drops);

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
      drawBreakingOverlay(breakingOverlay, miningState);

      hud.text =
        `Minecraft 2D (seed ${seed}) — ${saveStatus}\n` +
        `health: ${formatStat(survival.health)}/${MAX_HEALTH}  hunger: ${formatStat(survival.hunger)}/${MAX_HUNGER}  time: ${dayPhaseLabel(survival.dayTime)}\n` +
        `selected: ${selectedLabel(inventory, registry)}  pos (${player.x.toFixed(1)}, ${player.y.toFixed(1)})  @${TICK_RATE}Hz\n` +
        (survival.alive
          ? `move A/D · jump Space · sprint Shift · mine hold-LMB · place/use RMB · inventory E · drop Q`
          : `YOU DIED — press R to respawn`);
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
      blockEntities,
      drops,
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

/** Placeholder look: head/torso/legs rectangles in block units at feet-center. */
function createPlayerSprite(): Graphics {
  const w = Player.WIDTH;
  const h = Player.HEIGHT;
  const g = new Graphics();
  g.rect(-w / 2, -h, w, h * 0.28).fill('#c98e6d'); // head
  g.rect(-w / 2, -h * 0.72, w, h * 0.4).fill('#1fa4a0'); // torso
  g.rect(-w / 2, -h * 0.32, w, h * 0.32).fill('#3d3a8f'); // legs
  return g;
}

function viewportSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  return {
    width: canvas.clientWidth || window.innerWidth,
    height: canvas.clientHeight || window.innerHeight,
  };
}

function selectedLabel(
  inventory: Inventory,
  registry: ReturnType<typeof createBlockRegistry>,
): string {
  const slot = inventory.selectedSlot;
  if (!slot) return `${inventory.selectedIndex + 1}. empty`;
  const def = registry.byId(slot.blockId);
  return `${inventory.selectedIndex + 1}. ${def.name} x${slot.count}`;
}

function formatStat(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

void main();
