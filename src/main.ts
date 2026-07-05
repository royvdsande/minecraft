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
import { TICK_RATE } from './core/constants';

/** Minimum chunks kept on each side of the player, even in narrow windows. */
const MIN_STREAM_RADIUS = 4;
/** Extra chunks beyond the visible viewport to preload before the camera reaches them. */
const STREAM_MARGIN_CHUNKS = 2;

/**
 * TEMPORARY block palette (until the real hotbar/inventory in M6). Pick with
 * number keys 1-9 or the mouse wheel; right-click places the selection.
 */
const PALETTE = [
  'grass_block',
  'dirt',
  'stone',
  'cobblestone',
  'sand',
  'gravel',
  'oak_log',
  'oak_planks',
  'oak_leaves',
];

/**
 * M3: break blocks (left-click) and place the selected block (right-click),
 * both limited to REACH blocks from the player. Edits update the world and its
 * chunk view live.
 */
async function main(): Promise<void> {
  const app = await createApp();
  const registry = createBlockRegistry();
  const atlas = await loadBlockAtlas(registry.textureKeys());

  // Fresh random world each load (until per-world seeds land with save/load).
  const seed = (Math.random() * 0x100000000) >>> 0;
  const generator = new TerrainGenerator(seed, registry);
  const world = new World(registry, generator);
  const palette = PALETTE.map((key) => ({ key, id: registry.idOf(key) }));

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
  chunkStreamer.syncAround(
    player.x,
    streamRadiusForViewport(
      app.screen.width,
      camera.pixelsPerBlock,
      MIN_STREAM_RADIUS,
      STREAM_MARGIN_CHUNKS,
    ),
  );

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

  // Temporary block selection (until M6): number keys pick a palette slot.
  let selected = 0;
  window.addEventListener('keydown', (e) => {
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m && Number(m[1]) <= palette.length) selected = Number(m[1]) - 1;
  });

  const hud = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 14 },
  });
  hud.position.set(8, 8);
  app.stage.addChild(hud);

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

      chunkStreamer.syncAround(
        player.x,
        streamRadiusForViewport(
          app.screen.width,
          camera.pixelsPerBlock,
          MIN_STREAM_RADIUS,
          STREAM_MARGIN_CHUNKS,
        ),
      );

      // Cycle selection with the wheel.
      const wheel = mouse.takeWheelSteps();
      if (wheel !== 0) {
        selected = (((selected + wheel) % palette.length) + palette.length) % palette.length;
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
        target = { bx, by, inReach };

        if (inReach && leftClick && canBreak(registry.byId(world.getBlock(bx, by)))) {
          world.setBlock(bx, by, AIR);
          chunkStreamer.updateBlock(bx, by);
        }
        if (inReach && rightClick) {
          const sel = palette[selected];
          const targetIsAir = world.getBlock(bx, by) === AIR;
          if (
            sel &&
            canPlace(
              targetIsAir,
              registry.byId(sel.id).solid,
              bx,
              by,
              player.x,
              player.y,
              Player.WIDTH,
              Player.HEIGHT,
            )
          ) {
            world.setBlock(bx, by, sel.id);
            chunkStreamer.updateBlock(bx, by);
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

      camera.viewportWidth = app.screen.width;
      camera.viewportHeight = app.screen.height;
      camera.x = rx;
      camera.y = ry - Player.HEIGHT / 2;

      const origin = camera.worldToScreen(0, 0);
      worldView.position.set(origin.x, origin.y);
      worldView.scale.set(camera.pixelsPerBlock);

      if (target) {
        highlight.visible = true;
        highlight.position.set(target.bx, target.by);
        highlight.tint = target.inReach ? 0x33ff33 : 0xff5555;
      } else {
        highlight.visible = false;
      }

      const sel = palette[selected];
      hud.text =
        `Minecraft 2D — M5: infinite world (seed ${seed})\n` +
        `left-click break · right-click place · 1-9 or wheel to select\n` +
        `selected: ${sel ? `${selected + 1}. ${sel.key}` : '—'}\n` +
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

void main();
