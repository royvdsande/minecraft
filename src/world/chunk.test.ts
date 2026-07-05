import { describe, it, expect } from 'vitest';
import { Chunk } from './chunk';
import { CHUNK_SIZE, CHUNK_WIDTH, WORLD_HEIGHT } from '@/core/constants';

describe('Chunk', () => {
  it('stores blocks in a Uint16Array of the right size', () => {
    const chunk = new Chunk(0);
    expect(chunk.blocks).toBeInstanceOf(Uint16Array);
    expect(chunk.blocks.length).toBe(CHUNK_SIZE);
  });

  it('defaults every cell to air (0)', () => {
    const chunk = new Chunk(3);
    expect(chunk.get(0, 0)).toBe(0);
    expect(chunk.get(CHUNK_WIDTH - 1, WORLD_HEIGHT - 1)).toBe(0);
  });

  it('round-trips set/get', () => {
    const chunk = new Chunk(0);
    chunk.set(5, 100, 42);
    expect(chunk.get(5, 100)).toBe(42);
    expect(chunk.get(5, 101)).toBe(0);
    expect(chunk.get(6, 100)).toBe(0);
  });

  it('uses row-major indexing (index = y * CHUNK_WIDTH + localX)', () => {
    expect(Chunk.index(0, 0)).toBe(0);
    expect(Chunk.index(3, 2)).toBe(2 * CHUNK_WIDTH + 3);
    expect(Chunk.index(CHUNK_WIDTH - 1, WORLD_HEIGHT - 1)).toBe(CHUNK_SIZE - 1);
  });

  it('throws on out-of-range coordinates', () => {
    expect(() => Chunk.index(-1, 0)).toThrow(RangeError);
    expect(() => Chunk.index(CHUNK_WIDTH, 0)).toThrow(RangeError);
    expect(() => Chunk.index(0, -1)).toThrow(RangeError);
    expect(() => Chunk.index(0, WORLD_HEIGHT)).toThrow(RangeError);
  });
});
