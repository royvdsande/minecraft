/**
 * Pure AABB-vs-tilemap physics. No Pixi/DOM/World dependency — collision is
 * queried through a `SolidQuery` callback so this whole module is unit-testable
 * headless. Runs inside the fixed timestep (see core/loop.ts), so all values
 * are per-second and integrated with an explicit `dt`.
 *
 * Coordinate reminder (see CLAUDE.md): block units, Y points DOWN. Gravity is
 * +Y; a jump sets a negative (upward) vertical velocity.
 */

/** True if the block at integer world coords is solid (collidable). */
export type SolidQuery = (bx: number, by: number) => boolean;

/** Horizontal movement intent for one tick. */
export interface MoveInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint?: boolean;
}

/** Mutable motion state of an entity (anchor = feet-center, see CLAUDE.md). */
export interface Kinematic {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Standing on solid ground as of the last step (gates jumping). */
  grounded: boolean;
}

// Tuning (blocks / seconds). Chosen so a jump clears ~1.25 blocks and the
// terminal fall speed keeps per-tick motion well under one block at 60 Hz.
export const MOVE_SPEED = 4.3;
export const SPRINT_SPEED = 5.6;
export const JUMP_SPEED = 9;
export const GRAVITY = 32;
export const MAX_FALL_SPEED = 40;

/** Max displacement per collision sub-step, in blocks. Keeping this < 1
 * guarantees an AABB never tunnels through a one-block-thin wall or floor. */
const MAX_STEP = 0.25;
const EPS = 1e-7;

/**
 * Resolve horizontal movement of an AABB (min corner `minX,minY`, size `w,h`)
 * by `dx` against the tilemap. Returns the new left edge and whether it hit a
 * wall. Assumes |dx| < 1 (callers sub-step).
 */
export function moveX(
  minX: number,
  minY: number,
  w: number,
  h: number,
  dx: number,
  isSolid: SolidQuery,
): { x: number; hit: boolean } {
  const nx = minX + dx;
  const rowTop = Math.floor(minY + EPS);
  const rowBot = Math.ceil(minY + h - EPS) - 1;

  if (dx > 0) {
    const col = Math.floor(nx + w - EPS); // tile entered by the right edge
    for (let by = rowTop; by <= rowBot; by++) {
      if (isSolid(col, by)) return { x: col - w, hit: true };
    }
  } else if (dx < 0) {
    const col = Math.floor(nx + EPS); // tile entered by the left edge
    for (let by = rowTop; by <= rowBot; by++) {
      if (isSolid(col, by)) return { x: col + 1, hit: true };
    }
  }
  return { x: nx, hit: false };
}

/**
 * Resolve vertical movement of an AABB by `dy` against the tilemap. Returns the
 * new top edge and whether it hit floor/ceiling. Assumes |dy| < 1.
 */
export function moveY(
  minX: number,
  minY: number,
  w: number,
  h: number,
  dy: number,
  isSolid: SolidQuery,
): { y: number; hit: boolean } {
  const ny = minY + dy;
  const colLeft = Math.floor(minX + EPS);
  const colRight = Math.ceil(minX + w - EPS) - 1;

  if (dy > 0) {
    const row = Math.floor(ny + h - EPS); // tile entered by the bottom edge
    for (let bx = colLeft; bx <= colRight; bx++) {
      if (isSolid(bx, row)) return { y: row - h, hit: true };
    }
  } else if (dy < 0) {
    const row = Math.floor(ny + EPS); // tile entered by the top edge
    for (let bx = colLeft; bx <= colRight; bx++) {
      if (isSolid(bx, row)) return { y: row + 1, hit: true };
    }
  }
  return { y: ny, hit: false };
}

/**
 * Advance one entity by exactly `dt` seconds: apply input, gravity, and
 * axis-separated collision. Returns a fresh Kinematic (does not mutate input).
 */
export function stepPhysics(
  k: Readonly<Kinematic>,
  width: number,
  height: number,
  input: MoveInput,
  dt: number,
  isSolid: SolidQuery,
): Kinematic {
  // Horizontal velocity follows input directly for responsive controls.
  const movingHorizontally = input.left !== input.right;
  const moveSpeed = input.sprint === true && movingHorizontally ? SPRINT_SPEED : MOVE_SPEED;
  let vx = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * moveSpeed;
  let vy = k.vy;

  if (input.jump && k.grounded) vy = -JUMP_SPEED;
  vy = Math.min(vy + GRAVITY * dt, MAX_FALL_SPEED);

  let dx = vx * dt;
  let dy = vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_STEP));
  dx /= steps;
  dy /= steps;

  let minX = k.x - width / 2;
  let minY = k.y - height;
  let grounded = false;

  for (let i = 0; i < steps; i++) {
    const rx = moveX(minX, minY, width, height, dx, isSolid);
    minX = rx.x;
    if (rx.hit) {
      vx = 0;
      dx = 0;
    }

    const ry = moveY(minX, minY, width, height, dy, isSolid);
    minY = ry.y;
    if (ry.hit) {
      if (dy > 0) grounded = true; // hit while moving down = landed
      vy = 0;
      dy = 0;
    }
  }

  return { x: minX + width / 2, y: minY + height, vx, vy, grounded };
}
