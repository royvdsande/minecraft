import { Container, Graphics, Text } from 'pixi.js';
import { createApp } from './render/app';
import { Camera } from './render/camera';
import { loadBlockAtlas } from './render/texture-atlas';
import { createChunkView } from './render/chunk-view';
import { createBlockRegistry } from './blocks/registry';
import { World } from './world/world';
import { surfaceHeightAt } from './world/test-chunk';
import { Player } from './entity/player';
import { stepPhysics } from './entity/physics';
import { Keyboard } from './input/keyboard';
import { GameLoop } from './core/loop';
import { TICK_RATE } from './core/constants';

/** Chunks rendered around spawn for M2. Dynamic streaming arrives in M5. */
const RENDER_RANGE = 4;

/**
 * M2: the player walks, jumps, and collides with solid blocks under gravity,
 * simulated at a fixed 60 Hz and rendered with interpolation.
 */
async function main(): Promise<void> {
  const app = await createApp();
  const registry = createBlockRegistry();
  const atlas = await loadBlockAtlas(registry.textureKeys());
  const world = new World(registry);

  // Static render window (block units); the camera scales it to pixels.
  const worldView = new Container();
  for (let cx = -RENDER_RANGE; cx <= RENDER_RANGE; cx++) {
    worldView.addChild(createChunkView(world.getChunk(cx), registry, atlas));
  }

  const player = new Player();
  player.x = 8.5;
  player.y = surfaceHeightAt(8); // feet on the grass surface
  player.savePrev();
  const playerSprite = createPlayerSprite();
  worldView.addChild(playerSprite);

  app.stage.addChild(worldView);

  const camera = new Camera(32);
  const keyboard = new Keyboard();

  const hud = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 14 },
  });
  hud.position.set(8, 8);
  app.stage.addChild(hud);

  const isSolid = (bx: number, by: number): boolean => world.isSolid(bx, by);

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
    },
    render: (alpha) => {
      // Interpolate between the last two simulated positions for smooth motion.
      const rx = player.prevX + (player.x - player.prevX) * alpha;
      const ry = player.prevY + (player.y - player.prevY) * alpha;
      playerSprite.position.set(rx, ry);

      camera.viewportWidth = app.screen.width;
      camera.viewportHeight = app.screen.height;
      camera.x = rx;
      camera.y = ry - Player.HEIGHT / 2; // frame the body, not the feet

      const origin = camera.worldToScreen(0, 0);
      worldView.position.set(origin.x, origin.y);
      worldView.scale.set(camera.pixelsPerBlock);

      hud.text =
        `Minecraft 2D — M2: walk / jump / gravity / collision\n` +
        `pos (${player.x.toFixed(2)}, ${player.y.toFixed(2)})  vel (${player.vx.toFixed(
          1,
        )}, ${player.vy.toFixed(1)})\n` +
        `grounded: ${player.grounded}   @${TICK_RATE}Hz\n` +
        `A/D or ←/→ to move, W/Space/↑ to jump` +
        (atlas.missing.length > 0
          ? `\nmissing textures: ${atlas.missing.length} (see console)`
          : '');
    },
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __player: Player }).__player = player;
  }

  loop.start();
}

/** Placeholder look: head/torso/legs rectangles, drawn in block units at the
 * feet-center origin (so it stands on (0,0)). */
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
