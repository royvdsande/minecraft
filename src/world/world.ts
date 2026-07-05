import { WORLD_HEIGHT, chunkXOf, localXOf } from '@/core/constants';
import { AIR, type BlockRegistry } from '@/blocks/registry';
import type { BlockId } from '@/blocks/block';
import type { Chunk } from './chunk';
import type { TerrainGenerator } from '@/gen/terrain';

/**
 * The block world: a collection of chunks addressable by world block
 * coordinates. Chunks are generated lazily on first access. Render streaming
 * unloads views only; this cache is also the source for M7 save serialization.
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

  /** Insert a preloaded chunk, replacing generated data for that chunkX. */
  setChunk(chunk: Chunk): void {
    this.chunks.set(chunk.chunkX, chunk);
  }

  /** Cached/generated chunks sorted left-to-right, for deterministic saves. */
  cachedChunks(): readonly Chunk[] {
    return [...this.chunks.values()].sort((a, b) => a.chunkX - b.chunkX);
  }

  cachedChunkXs(): number[] {
    return this.cachedChunks().map((chunk) => chunk.chunkX);
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
