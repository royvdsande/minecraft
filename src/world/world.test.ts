import { describe, expect, it } from 'vitest';
import { createBlockRegistry } from '@/blocks/registry';
import { CHUNK_WIDTH } from '@/core/constants';
import { TerrainGenerator } from '@/gen/terrain';
import { World } from './world';

describe('World', () => {
  it('keeps generated chunks cached so in-session edits survive view unloads', () => {
    const registry = createBlockRegistry();
    const world = new World(registry, new TerrainGenerator(123, registry));
    const chunk = world.getChunk(0);
    const stone = registry.idOf('stone');

    chunk.set(0, 0, stone);
    world.getChunk(5);

    expect(world.getChunk(0)).toBe(chunk);
    expect(world.getBlock(0, 0)).toBe(stone);
  });

  it('exposes cached chunks sorted by chunk coordinate', () => {
    const registry = createBlockRegistry();
    const world = new World(registry, new TerrainGenerator(123, registry));

    world.getChunk(3);
    world.getChunk(-1);
    world.getChunk(0);

    expect(world.cachedChunkXs()).toEqual([-1, 0, 3]);
  });

  it('can replace a generated chunk with preloaded save data', () => {
    const registry = createBlockRegistry();
    const world = new World(registry, new TerrainGenerator(123, registry));
    const chunk = world.getChunk(2);
    const dirt = registry.idOf('dirt');

    chunk.set(4, 5, dirt);
    world.setChunk(chunk);

    expect(world.getBlock(2 * CHUNK_WIDTH + 4, 5)).toBe(dirt);
  });
});
