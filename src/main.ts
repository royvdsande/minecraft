import { Container, Graphics, Text } from 'pixi.js';
import { createApp } from './render/app';
import { Camera } from './render/camera';
import { loadBlockAtlas } from './render/texture-atlas';
import { ChunkStreamer, streamRadiusForViewport } from './render/chunk-streamer';
import { createBlockRegistry, AIR } from './blocks/registry';
import { World } from './world/world';
import { TerrainGenerator, SEA_LEVEL } from './gen/terrain';
import { canBreak, canPlace, withinReach } from './world/interaction';
import { Player } from './entity/player';
import { stepPhysics } from './entity/physics';
import { Keyboard } from './input/keyboard';
import { Mouse } from './input/mouse';
import { GameLoop } from './core/loop';
import { TICK_RATE, WORLD_HEIGHT } from './core/constants';
import { Inventory } from './ui/inventory';
import { HotbarView } from './ui/hotbar-view';
import { deserializeGame, serializeGame } from './storage/save-data';
import { loadSavedGame, openSaveDatabase, saveGame } from './storage/indexed-db';

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

  const playerSprite = createPlayerSprite();
  worldView.addChild(playerSprite);

  // Target-cell outline (drawn on top of everything in the world).
  const highlight = new Graphics();
  highlight.rect(0, 0, 1, 1).stroke({ width: 0.06, color: 0xffffff, alignment: 0.5 });
  highlight.visible = false;
  worldView.addChild(highlight);

  app.stage.addChild(worldView);

  const keyboard = new Keyboard();
  const mouse = new Mouse(app.canvas);

  window.addEventListener('keydown', (e) => {
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) inventory.select(Number(m[1]) - 1);
  });

  const hud = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 14 },
  });
  hud.position.set(8, 8);
  app.stage.addChild(hud);

  const hotbarView = new HotbarView(inventory, registry, atlas);
  app.stage.addChild(hotbarView.container);

  const isSolid = (bx: number, by: number): boolean => world.isSolid(bx, by);

  // Current mouse target, recomputed each tick for rendering the highlight.
  let target: { bx: number; by: number; inReach: boolean } | null = null;

  const loop = new GameLoop({
    update: (dt) => {
      player.savePrev();
      const next = stepPhysics(
        player,
        Player.WIDTH,
        Player.HEIGHT,
        keyboard.moveInput,
        dt,
        isSolid,
      );
      player.x = next.x;
      player.y = next.y;
      player.vx = next.vx;
      player.vy = next.vy;
      player.grounded = next.grounded;

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
      if (wheel !== 0) {
        inventory.cycleSelected(wheel);
      }

      // Resolve the targeted cell and handle break/place.
      const leftClick = mouse.takeLeftClick();
      const rightClick = mouse.takeRightClick();
      if (mouse.hasPosition) {
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
        if (
          insideWorld &&
          inReach &&
          leftClick &&
          canBreak(targetDef) &&
          (dropId === null || inventory.canAdd(dropId))
        ) {
          world.setBlock(bx, by, AIR);
          chunkStreamer.updateBlock(bx, by);
          if (dropId !== null) inventory.add(dropId);
          queueSave();
        }

        const selectedSlot = inventory.selectedSlot;
        if (insideWorld && inReach && rightClick && selectedSlot) {
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
              queueSave();
            }
          }
        }
      } else {
        target = null;
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

      hotbarView.layout(viewport.width, viewport.height);
      hotbarView.update();

      if (target) {
        highlight.visible = true;
        highlight.position.set(target.bx, target.by);
        highlight.tint = target.inReach ? 0x33ff33 : 0xff5555;
      } else {
        highlight.visible = false;
      }

      hud.text =
        `Minecraft 2D — M7: save/load (seed ${seed})\n` +
        `${saveStatus}\n` +
        `selected: ${selectedLabel(inventory, registry)}\n` +
        `slots: ${filledSlots(inventory)}/${inventory.size}  items: ${totalItems(inventory)}\n` +
        `pos (${player.x.toFixed(1)}, ${player.y.toFixed(1)})  chunk ${chunkStreamer.renderedChunkXs().join(',')}  grounded: ${player.grounded}  @${TICK_RATE}Hz`;
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
      saveNow,
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
  return `${inventory.selectedIndex + 1}. ${def.key} x${slot.count}`;
}

function filledSlots(inventory: Inventory): number {
  return inventory.snapshot().filter((slot) => slot !== null).length;
}

function totalItems(inventory: Inventory): number {
  return inventory.snapshot().reduce((total, slot) => total + (slot?.count ?? 0), 0);
}

void main();
