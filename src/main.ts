import { Text } from 'pixi.js';
import { createApp } from './render/app';
import { GameLoop } from './core/loop';
import { TICK_RATE } from './core/constants';

/**
 * M0 scaffold entry point. Proves the toolchain end-to-end: PixiJS renders,
 * and the fixed-timestep loop drives an update/render split. Real gameplay
 * arrives in the milestones (see CLAUDE.md).
 */
async function main(): Promise<void> {
  const app = await createApp();

  const hud = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 16 },
  });
  hud.position.set(8, 8);
  app.stage.addChild(hud);

  // Simulation state: a tick counter proving updates run at a fixed rate,
  // independent of the render framerate.
  let ticks = 0;
  let frames = 0;
  let fpsTimer = 0;
  let fps = 0;

  const loop = new GameLoop({
    update: (dt) => {
      ticks++;
      fpsTimer += dt;
    },
    render: (alpha) => {
      frames++;
      if (fpsTimer >= 1) {
        fps = frames;
        frames = 0;
        fpsTimer = 0;
      }
      hud.text =
        `Minecraft 2D — M0 scaffold\n` +
        `ticks: ${ticks} (@${TICK_RATE}Hz)\n` +
        `fps: ${fps}\n` +
        `alpha: ${alpha.toFixed(2)}`;
    },
  });

  loop.start();
}

void main();
