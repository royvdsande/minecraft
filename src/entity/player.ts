/**
 * The player entity. M1: position only (a standing sprite); physics and
 * input arrive in M2.
 *
 * POSITION CONVENTION (all entities): `(x, y)` is the FEET CENTER in block
 * units — x is the horizontal middle of the body, y is the bottom. Standing
 * on top of block row `by` means `y === by`. The collision AABB is
 * [x - WIDTH/2, y - HEIGHT] to [x + WIDTH/2, y].
 */
export class Player {
  /** Hitbox size in block units (Minecraft's player dimensions). */
  static readonly WIDTH = 0.6;
  static readonly HEIGHT = 1.8;

  x = 0;
  y = 0;
}
