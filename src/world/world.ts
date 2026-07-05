import { WORLD_HEIGHT, chunkXOf, localXOf } from '@/core/constants';
import { AIR, type BlockRegistry } from '@/blocks/registry';
import type { BlockId } from '@/blocks/block';
import type { Chunk } from './chunk';
import type { TerrainGenerator } from '@/gen/terrain';

/**
 * The block world: a collection of chunks addressable by world block
 * coordinates. Chunks are generated lazily on first access; load/unload
 * streaming arrives in M5. The interface (getBlock / isSolid / setBlock) is
 * stable.
 */
export class World {
  private readonly chunks = new Map<number, Chunk>();

  constructor(
    private readonly registry: BlockRegistry,
    private readonly generator: TerrainGenerator,
  ) {}

  /** Get (generating if needed) the chunk covering horizontal index chunkX. */
  getChunk(chunkX: number): Chunk {
    let chunk = this.chunks.get(chunkX);
    if (!chunk) {
      chunk = this.generator.generateChunk(chunkX);
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
