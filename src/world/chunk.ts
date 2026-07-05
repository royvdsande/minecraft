import { CHUNK_SIZE, CHUNK_WIDTH, WORLD_HEIGHT } from '@/core/constants';
import type { BlockId } from '@/blocks/block';

/**
 * One vertical slice of the world: CHUNK_WIDTH x WORLD_HEIGHT block ids in a
 * flat Uint16Array (row-major: `index = y * CHUNK_WIDTH + localX`).
 *
 * Storage only — no gameplay logic lives here. A zero-filled array is all air
 * because air is id 0 by contract (see blocks/registry.ts).
 */
export class Chunk {
  /** Raw block storage. Exposed for serialization (M7) and tests. */
  readonly blocks = new Uint16Array(CHUNK_SIZE);

  constructor(
    /** Horizontal chunk index: covers world x in [chunkX*16, chunkX*16+16). */
    readonly chunkX: number,
  ) {}

  /** Flat index of a local cell. Throws on out-of-range coordinates. */
  static index(localX: number, y: number): number {
    if (localX < 0 || localX >= CHUNK_WIDTH || y < 0 || y >= WORLD_HEIGHT) {
      throw new RangeError(`Chunk cell out of range: (${localX}, ${y})`);
    }
    return y * CHUNK_WIDTH + localX;
  }

  get(localX: number, y: number): BlockId {
    // `?? 0` only satisfies noUncheckedIndexedAccess; index() already
    // guarantees the slot exists.
    return this.blocks[Chunk.index(localX, y)] ?? 0;
  }

  set(localX: number, y: number, id: BlockId): void {
    this.blocks[Chunk.index(localX, y)] = id;
  }
}
