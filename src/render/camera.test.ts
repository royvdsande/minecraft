import { describe, it, expect } from 'vitest';
import { Camera } from './camera';

function makeCamera(): Camera {
  const cam = new Camera(32);
  cam.viewportWidth = 800;
  cam.viewportHeight = 600;
  cam.x = 10;
  cam.y = 120;
  return cam;
}

describe('Camera', () => {
  it('maps the camera position to the viewport center', () => {
    const cam = makeCamera();
    expect(cam.worldToScreen(10, 120)).toEqual({ x: 400, y: 300 });
  });

  it('moves one block = pixelsPerBlock pixels, y-down stays y-down', () => {
    const cam = makeCamera();
    expect(cam.worldToScreen(11, 120)).toEqual({ x: 432, y: 300 });
    expect(cam.worldToScreen(10, 121)).toEqual({ x: 400, y: 332 });
    expect(cam.worldToScreen(9, 119)).toEqual({ x: 368, y: 268 });
  });

  it('screenToWorld inverts worldToScreen', () => {
    const cam = makeCamera();
    const s = cam.worldToScreen(-3.25, 141.5);
    const w = cam.screenToWorld(s.x, s.y);
    expect(w.x).toBeCloseTo(-3.25);
    expect(w.y).toBeCloseTo(141.5);
  });

  it('zoom scales the mapping', () => {
    const cam = makeCamera();
    cam.pixelsPerBlock = 16;
    expect(cam.worldToScreen(11, 120).x).toBe(416);
  });
});
