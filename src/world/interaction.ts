import type { BlockDef } from '@/blocks/block';

/**
 * Pure rules for mouse block interaction (break/place). No Pixi/DOM — the
 * caller supplies coordinates and block data, so these are unit-testable.
 * All coordinates are block units (see CLAUDE.md).
 */

/** How far (in blocks, from the reach origin) the player can reach. */
export const REACH = 5;

/** Distance from `(px, py)` to the CENTER of block cell `(bx, by)`. */
export function distanceToBlockCenter(px: number, py: number, bx: number, by: number): number {
  return Math.hypot(bx + 0.5 - px, by + 0.5 - py);
}

/** Whether block `(bx, by)` is close enough to interact with. */
export function withinReach(
  px: number,
  py: number,
  bx: number,
  by: number,
  reach: number = REACH,
): boolean {
  return distanceToBlockCenter(px, py, bx, by) <= reach;
}

/**
 * Whether the 1x1 cell at `(bx, by)` overlaps a body AABB anchored at
 * feet-center `(px, py)` with size `w x h` (see the entity convention).
 */
export function blockIntersectsBody(
  bx: number,
  by: number,
  px: number,
  py: number,
  w: number,
  h: number,
): boolean {
  const left = px - w / 2;
  const right = px + w / 2;
  const top = py - h;
  const bottom = py;
  return left < bx + 1 && right > bx && top < by + 1 && bottom > by;
}

/** A block can be broken if it is not air and not unbreakable (hardness < 0). */
export function canBreak(def: BlockDef): boolean {
  return def.key !== 'air' && def.hardness >= 0;
}

/**
 * A block can be placed at a target cell if the target is empty and, when the
 * placed block is solid, it would not trap the player inside it.
 */
export function canPlace(
  targetIsAir: boolean,
  selectedSolid: boolean,
  bx: number,
  by: number,
  px: number,
  py: number,
  w: number,
  h: number,
): boolean {
  if (!targetIsAir) return false;
  if (selectedSolid && blockIntersectsBody(bx, by, px, py, w, h)) return false;
  return true;
}
