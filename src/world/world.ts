import { WORLD_HEIGHT, chunkXOf, localXOf } from '@/core/constants';
import { AIR, type BlockRegistry } from '@/blocks/registry';
import type { BlockId } from '@/blocks/block';
import type { Chunk } from './chunk';
import { createTestChunk } from './test-chunk';

/**
 * The block world: a collection of chunks addressable by world block
 * coordinates. For M2 chunks are generated lazily from the temporary test
 * terrain on first access; real generation and load/unload streaming arrive in
 * M4/M5. The interface (getBlock / isSolid / setBlock) stays the same.
 */
export class World {
  private readonly chunks = new Map<number, Chunk>();

  constructor(private readonly registry: BlockRegistry) {}

  /** Get (generating if needed) the chunk covering horizontal index chunkX. */
  getChunk(chunkX: number): Chunk {
    let chunk = this.chunks.get(chunkX);
    if (!chunk) {
      chunk = createTestChunk(chunkX, this.registry);
      this.chunks.set(chunkX, chunk);
    }
    return chunk;
  }

  /** Block id at world coords. Above/below the world is air. */
  getBlock(bx: number, by: number): BlockId {
    if (by < 0 || by >= WORLD_HEIGHT) return AIR;
    return this.getChunk(chunkXOf(bx)).get(localXOf(bx), by);
  }

  setBlock(bx: number, by: number, id: BlockId): void {
    if (by < 0 || by >= WORLD_HEIGHT) return;
    this.getChunk(chunkXOf(bx)).set(localXOf(bx), by, id);
  }

  /** Whether the block at world coords collides with entities. */
  isSolid(bx: number, by: number): boolean {
    return this.registry.byId(this.getBlock(bx, by)).solid;
  }
}
