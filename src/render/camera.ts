/**
 * Camera: maps world positions (block units, y-down) to screen pixels.
 *
 * `(x, y)` is the world point at the CENTER of the viewport. Pure math, no
 * Pixi dependency, so it is unit-testable; the render side applies the same
 * transform to the world container each frame (see main.ts).
 */
export class Camera {
  /** World position (block units) shown at the viewport center. */
  x = 0;
  y = 0;
  /** Viewport size in CSS pixels; kept in sync with the canvas each frame. */
  viewportWidth = 0;
  viewportHeight = 0;

  constructor(
    /** Zoom: screen pixels per block. 32 = 2x scale of 16px textures. */
    public pixelsPerBlock = 32,
  ) {}

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.pixelsPerBlock + this.viewportWidth / 2,
      y: (wy - this.y) * this.pixelsPerBlock + this.viewportHeight / 2,
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewportWidth / 2) / this.pixelsPerBlock + this.x,
      y: (sy - this.viewportHeight / 2) / this.pixelsPerBlock + this.y,
    };
  }
}
