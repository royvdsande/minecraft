import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '@/core/constants';
import { Chunk } from '@/world/chunk';
import {
  SAVE_VERSION,
  deserializeChunk,
  deserializeGame,
  serializeChunk,
  serializeGame,
} from './save-data';

describe('save data serialization', () => {
  it('round-trips a chunk without sharing block storage', () => {
    const chunk = new Chunk(-2);
    chunk.set(3, 10, 42);

    const data = serializeChunk(chunk);
    chunk.set(3, 10, 7);
    const restored = deserializeChunk(data);

    expect(restored.chunkX).toBe(-2);
    expect(restored.get(3, 10)).toBe(42);
  });

  it('serializes games with sorted chunks and metadata', () => {
    const left = new Chunk(-1);
    const right = new Chunk(2);

    const data = serializeGame(1234, [right, left], 99);

    expect(data.version).toBe(SAVE_VERSION);
    expect(data.seed).toBe(1234);
    expect(data.savedAt).toBe(99);
    expect(data.chunks.map((chunk) => chunk.chunkX)).toEqual([-1, 2]);
  });

  it('deserializes game chunks', () => {
    const chunk = new Chunk(5);
    chunk.set(1, 2, 9);
    const data = serializeGame(555, [chunk], 1);

    const restored = deserializeGame(data);

    expect(restored.seed).toBe(555);
    expect(restored.chunks).toHaveLength(1);
    expect(restored.chunks[0]?.get(1, 2)).toBe(9);
  });

  it('rejects invalid chunk payloads', () => {
    expect(() => deserializeChunk({ chunkX: 0.5, blocks: new Uint16Array(CHUNK_SIZE) })).toThrow(
      RangeError,
    );
    expect(() => deserializeChunk({ chunkX: 0, blocks: new Uint16Array(1) })).toThrow(RangeError);
  });

  it('rejects unsupported save versions and invalid seeds', () => {
    const valid = serializeGame(1, [], 1);

    expect(() => serializeGame(-1, [], 1)).toThrow(RangeError);
    expect(() => deserializeGame({ ...valid, version: 999 })).toThrow(/Unsupported save version/);
    expect(() => deserializeGame({ ...valid, seed: 0.5 })).toThrow(RangeError);
  });
});
