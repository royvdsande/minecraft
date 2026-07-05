import type { Kinematic } from './physics';

/**
 * The player entity: a kinematic body plus the previous-tick position kept for
 * render interpolation (the fixed-timestep loop hands render an `alpha` between
 * the last two ticks).
 *
 * POSITION CONVENTION (all entities): `(x, y)` is the FEET CENTER in block
 * units — x is the horizontal middle of the body, y is the bottom. Standing on
 * top of block row `by` means `y === by`. The collision AABB spans
 * [x - WIDTH/2, y - HEIGHT] to [x + WIDTH/2, y].
 */
export class Player implements Kinematic {
  /** Hitbox size in block units (Minecraft's player dimensions). */
  static readonly WIDTH = 0.6;
  static readonly HEIGHT = 1.8;

  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  grounded = false;

  /** Position at the end of the previous tick, for interpolation. */
  prevX = 0;
  prevY = 0;

  /** Snapshot the current position as "previous" before the next tick. */
  savePrev(): void {
    this.prevX = this.x;
    this.prevY = this.y;
  }
}
