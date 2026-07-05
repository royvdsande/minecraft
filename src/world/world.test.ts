import { describe, expect, it } from 'vitest';
import { createBlockRegistry } from '@/blocks/registry';
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
});
