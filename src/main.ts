import { Container, Graphics, Text } from 'pixi.js';
import { createApp } from './render/app';
import { Camera } from './render/camera';
import { loadBlockAtlas } from './render/texture-atlas';
import { createChunkView } from './render/chunk-view';
import { createBlockRegistry } from './blocks/registry';
import { createTestChunk, surfaceHeightAt } from './world/test-chunk';
import { Player } from './entity/player';
import { GameLoop } from './core/loop';
import { TICK_RATE } from './core/constants';

/**
 * M1: render one chunk of tiles through the camera, with a standing player
 * sprite. Physics and input arrive in M2.
 */
async function main(): Promise<void> {
  const app = await createApp();
  const registry = createBlockRegistry();
  const atlas = await loadBlockAtlas(registry.textureKeys());

  // World scene graph, in block units; the camera transform scales it.
  const world = new Container();
  const chunk = createTestChunk(0, registry);
  world.addChild(createChunkView(chunk, registry, atlas));

  const player = new Player();
  player.x = 8.5;
  player.y = surfaceHeightAt(8); // feet on top of the grass block
  world.addChild(createPlayerSprite(player));

  app.stage.addChild(world);

  const camera = new Camera(32);
  camera.x = player.x;
  camera.y = player.y - Player.HEIGHT / 2; // frame the body, not the feet

  const hud = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 16 },
  });
  hud.position.set(8, 8);
  app.stage.addChild(hud);

  let ticks = 0;
  const loop = new GameLoop({
    update: () => {
      ticks++;
    },
    render: (_alpha) => {
      camera.viewportWidth = app.screen.width;
      camera.viewportHeight = app.screen.height;

      // Same transform as camera.worldToScreen, applied to the container:
      // world origin lands at worldToScreen(0, 0), one block = ppb pixels.
      const origin = camera.worldToScreen(0, 0);
      world.position.set(origin.x, origin.y);
      world.scale.set(camera.pixelsPerBlock);

      hud.text =
        `Minecraft 2D — M1: one chunk + camera\n` +
        `ticks: ${ticks} (@${TICK_RATE}Hz)\n` +
        `missing textures: ${atlas.missing.length}` +
        (atlas.missing.length > 0 ? ' (see console)' : '');
    },
  });

  loop.start();
}

/** Placeholder look: simple head/torso/legs rectangles in block units. */
function createPlayerSprite(player: Player): Graphics {
  const w = Player.WIDTH;
  const h = Player.HEIGHT;
  const g = new Graphics();
  g.rect(-w / 2, -h, w, h * 0.28).fill('#c98e6d'); // head
  g.rect(-w / 2, -h * 0.72, w, h * 0.4).fill('#1fa4a0'); // torso
  g.rect(-w / 2, -h * 0.32, w, h * 0.32).fill('#3d3a8f'); // legs
  g.position.set(player.x, player.y);
  return g;
}

void main();
