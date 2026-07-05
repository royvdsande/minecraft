import { describe, it, expect } from 'vitest';
import { createTestChunk, surfaceHeightAt } from './test-chunk';
import { createBlockRegistry, AIR } from '@/blocks/registry';
import { WORLD_HEIGHT } from '@/core/constants';

describe('createTestChunk', () => {
  const registry = createBlockRegistry();

  it('is deterministic: same chunkX yields identical blocks', () => {
    const a = createTestChunk(2, registry);
    const b = createTestChunk(2, registry);
    expect(a.blocks).toEqual(b.blocks);
  });

  it('differs between chunk positions', () => {
    const a = createTestChunk(0, registry);
    const b = createTestChunk(1, registry);
    expect(a.blocks).not.toEqual(b.blocks);
  });

  it('has air above the surface and grass on it', () => {
    const chunk = createTestChunk(0, registry);
    const surface = surfaceHeightAt(0);
    expect(chunk.get(0, surface - 20)).toBe(AIR);
    expect(chunk.get(0, surface)).toBe(registry.idOf('grass_block'));
    expect(chunk.get(0, surface + 1)).toBe(registry.idOf('dirt'));
  });

  it('ends in bedrock at the bottom', () => {
    const chunk = createTestChunk(0, registry);
    for (let lx = 0; lx < 16; lx++) {
      expect(chunk.get(lx, WORLD_HEIGHT - 1)).toBe(registry.idOf('bedrock'));
    }
  });
});
