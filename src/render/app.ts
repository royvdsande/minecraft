import { Application, TextureStyle } from 'pixi.js';

/**
 * Create and initialise the PixiJS application, mounted into `#app`.
 *
 * Pixel-art must stay crisp: we force nearest-neighbour scaling globally so
 * upscaled 16x16 textures never blur. `roundPixels` keeps sprites on whole
 * device pixels to avoid shimmering when the camera moves.
 */
export async function createApp(): Promise<Application> {
  // Applies to every texture created afterwards.
  TextureStyle.defaultOptions.scaleMode = 'nearest';

  const app = new Application();
  await app.init({
    background: '#6ec0ff', // placeholder sky
    resizeTo: window,
    antialias: false,
    roundPixels: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  const mount = document.querySelector<HTMLDivElement>('#app');
  if (!mount) throw new Error('Missing #app mount element');
  mount.appendChild(app.canvas);

  return app;
}
