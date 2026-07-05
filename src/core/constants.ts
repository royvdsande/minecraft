/**
 * Global constants and the single source of truth for the coordinate system.
 *
 * COORDINATE SYSTEM (see CLAUDE.md for the full explanation):
 *  - The world is infinite along X and fixed-height along Y.
 *  - Block coordinates (bx, by) are integers.
 *  - The Y axis points DOWN: by = 0 is the top of the sky, by = WORLD_HEIGHT-1
 *    is the bottom (bedrock). Gravity accelerates entities toward +Y.
 *  - Entity positions are floats measured in BLOCK UNITS (1 unit = 1 block),
 *    never in pixels. Pixels only exist at render time (worldToScreen).
 */

/** Simulation tick rate. Physics/logic run at this fixed frequency. */
export const TICK_RATE = 60;
/** Seconds per simulation step. */
export const FIXED_DT = 1 / TICK_RATE;

/** Blocks per chunk column, horizontally. */
export const CHUNK_WIDTH = 16;
/** Total world height in blocks. A chunk spans the full height. */
export const WORLD_HEIGHT = 256;
/** Number of block slots stored in a single chunk. */
export const CHUNK_SIZE = CHUNK_WIDTH * WORLD_HEIGHT;

/** Source texture resolution. Real Minecraft textures are 16x16. */
export const TEXTURE_SIZE = 16;

/** Convert a world block X to its chunk index (floor division). */
export function chunkXOf(bx: number): number {
  return Math.floor(bx / CHUNK_WIDTH);
}

/** Local X (0..CHUNK_WIDTH-1) of a world block X within its chunk. */
export function localXOf(bx: number): number {
  return ((bx % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
}
