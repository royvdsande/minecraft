import { CHUNK_SIZE } from '@/core/constants';
import { Chunk } from '@/world/chunk';

export const SAVE_VERSION = 1;

export interface SerializedChunk {
  readonly chunkX: number;
  readonly blocks: Uint16Array;
}

export interface SerializedGame {
  readonly version: number;
  readonly seed: number;
  readonly savedAt: number;
  readonly chunks: readonly SerializedChunk[];
}

export function serializeChunk(chunk: Chunk): SerializedChunk {
  return {
    chunkX: chunk.chunkX,
    blocks: new Uint16Array(chunk.blocks),
  };
}

export function deserializeChunk(data: SerializedChunk): Chunk {
  if (!Number.isInteger(data.chunkX)) {
    throw new RangeError(`Saved chunkX must be an integer: ${data.chunkX}`);
  }
  if (!(data.blocks instanceof Uint16Array) || data.blocks.length !== CHUNK_SIZE) {
    throw new RangeError(`Saved chunk ${data.chunkX} has invalid block storage`);
  }

  const chunk = new Chunk(data.chunkX);
  chunk.blocks.set(data.blocks);
  return chunk;
}

export function serializeGame(
  seed: number,
  chunks: Iterable<Chunk>,
  savedAt: number = Date.now(),
): SerializedGame {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`Seed must be a uint32: ${seed}`);
  }
  if (!Number.isFinite(savedAt)) {
    throw new RangeError(`savedAt must be finite: ${savedAt}`);
  }

  const serializedChunks = [...chunks].map(serializeChunk).sort((a, b) => a.chunkX - b.chunkX);
  return {
    version: SAVE_VERSION,
    seed,
    savedAt,
    chunks: serializedChunks,
  };
}

export function deserializeGame(data: SerializedGame): { seed: number; chunks: Chunk[] } {
  if (data.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${data.version}`);
  }
  if (!Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff) {
    throw new RangeError(`Saved seed must be a uint32: ${data.seed}`);
  }

  return {
    seed: data.seed,
    chunks: data.chunks.map(deserializeChunk),
  };
}
