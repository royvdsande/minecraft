import { describe, expect, it } from 'vitest';
import {
  chunkWindow,
  chunkWindowForPosition,
  diffChunkWindow,
  planChunkStreaming,
} from './chunk-stream';

describe('chunk streaming window', () => {
  it('returns an inclusive chunk range around a center chunk', () => {
    expect(chunkWindow(0, 2)).toEqual([-2, -1, 0, 1, 2]);
    expect(chunkWindow(-3, 1)).toEqual([-4, -3, -2]);
    expect(chunkWindow(7, 0)).toEqual([7]);
  });

  it('maps world positions to their containing chunk before building the window', () => {
    expect(chunkWindowForPosition(0, 1)).toEqual([-1, 0, 1]);
    expect(chunkWindowForPosition(15.99, 1)).toEqual([-1, 0, 1]);
    expect(chunkWindowForPosition(16, 1)).toEqual([0, 1, 2]);
    expect(chunkWindowForPosition(-0.01, 1)).toEqual([-2, -1, 0]);
    expect(chunkWindowForPosition(-16, 1)).toEqual([-2, -1, 0]);
  });

  it('rejects invalid stream inputs', () => {
    expect(() => chunkWindow(0, -1)).toThrow(RangeError);
    expect(() => chunkWindow(0, 1.5)).toThrow(RangeError);
    expect(() => chunkWindow(0.5, 1)).toThrow(RangeError);
    expect(() => chunkWindowForPosition(Number.NaN, 1)).toThrow(RangeError);
  });
});

describe('chunk streaming diff', () => {
  it('returns sorted load and unload sets', () => {
    const diff = diffChunkWindow([3, 2, 0, -1], [-1, 0, 1, 2]);
    expect(diff.toLoad).toEqual([1]);
    expect(diff.toUnload).toEqual([3]);
  });

  it('does nothing when loaded chunks already match the desired window', () => {
    expect(diffChunkWindow([-1, 0, 1], [1, 0, -1])).toEqual({
      toLoad: [],
      toUnload: [],
    });
  });

  it('plans the complete transition around a moving player', () => {
    expect(planChunkStreaming([-2, -1, 0, 1, 2], 16.1, 2)).toEqual({
      desired: [-1, 0, 1, 2, 3],
      toLoad: [3],
      toUnload: [-2],
    });
  });
});
