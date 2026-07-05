import { chunkXOf } from '@/core/constants';

export interface ChunkStreamPlan {
  /** Complete desired chunk window, sorted from left to right. */
  desired: readonly number[];
  /** Chunks that should be created/rendered, sorted from left to right. */
  toLoad: readonly number[];
  /** Chunks that should be destroyed as views, sorted from left to right. */
  toUnload: readonly number[];
}

function assertRadius(radius: number): void {
  if (!Number.isInteger(radius) || radius < 0) {
    throw new RangeError(`Chunk stream radius must be a non-negative integer: ${radius}`);
  }
}

/** Desired chunk columns around a center chunk, inclusive on both sides. */
export function chunkWindow(centerChunkX: number, radius: number): number[] {
  assertRadius(radius);
  if (!Number.isInteger(centerChunkX)) {
    throw new RangeError(`Center chunk must be an integer: ${centerChunkX}`);
  }

  const chunks: number[] = [];
  for (let chunkX = centerChunkX - radius; chunkX <= centerChunkX + radius; chunkX++) {
    chunks.push(chunkX);
  }
  return chunks;
}

/** Desired chunk columns around a world-X position in block units. */
export function chunkWindowForPosition(worldX: number, radius: number): number[] {
  if (!Number.isFinite(worldX)) {
    throw new RangeError(`World X must be finite: ${worldX}`);
  }
  return chunkWindow(chunkXOf(worldX), radius);
}

/** Pure add/remove diff from currently loaded chunks to the desired window. */
export function diffChunkWindow(
  loadedChunks: Iterable<number>,
  desiredChunks: Iterable<number>,
): Pick<ChunkStreamPlan, 'toLoad' | 'toUnload'> {
  const loaded = new Set(loadedChunks);
  const desired = new Set(desiredChunks);

  const toLoad = [...desired].filter((chunkX) => !loaded.has(chunkX));
  const toUnload = [...loaded].filter((chunkX) => !desired.has(chunkX));

  toLoad.sort((a, b) => a - b);
  toUnload.sort((a, b) => a - b);

  return { toLoad, toUnload };
}

/** Full streaming plan for a player/world X position. */
export function planChunkStreaming(
  loadedChunks: Iterable<number>,
  worldX: number,
  radius: number,
): ChunkStreamPlan {
  const desired = chunkWindowForPosition(worldX, radius);
  return { desired, ...diffChunkWindow(loadedChunks, desired) };
}
