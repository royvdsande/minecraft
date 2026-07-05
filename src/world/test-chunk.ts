import { Chunk } from './chunk';
import { CHUNK_WIDTH, WORLD_HEIGHT } from '@/core/constants';
import type { BlockRegistry } from '@/blocks/registry';

/**
 * TEMPORARY (M1-M3): hand-rolled deterministic terrain so we have something
 * to render and collide with. Replaced by real seeded noise generation in M4.
 */

/** Surface height (block y of the grass layer) at world block x. */
export function surfaceHeightAt(bx: number): number {
  return 120 + Math.round(3 * Math.sin(bx / 7) + 2 * Math.sin(bx / 3));
}

/** Build one deterministic test chunk: grass, dirt, stone, ores, bedrock. */
export function createTestChunk(chunkX: number, registry: BlockRegistry): Chunk {
  const chunk = new Chunk(chunkX);
  const grass = registry.idOf('grass_block');
  const dirt = registry.idOf('dirt');
  const stone = registry.idOf('stone');
  const bedrock = registry.idOf('bedrock');
  const coal = registry.idOf('coal_ore');
  const iron = registry.idOf('iron_ore');

  for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
    const bx = chunkX * CHUNK_WIDTH + lx;
    const surface = surfaceHeightAt(bx);

    chunk.set(lx, surface, grass);
    for (let y = surface + 1; y <= surface + 4; y++) chunk.set(lx, y, dirt);
    for (let y = surface + 5; y < WORLD_HEIGHT - 1; y++) {
      // Deterministic ore sprinkle, iron only deeper down.
      if ((bx * 31 + y * 17) % 53 === 0) chunk.set(lx, y, coal);
      else if (y > 180 && (bx * 13 + y * 29) % 89 === 0) chunk.set(lx, y, iron);
      else chunk.set(lx, y, stone);
    }
    chunk.set(lx, WORLD_HEIGHT - 1, bedrock);
  }

  // One little oak tree in chunk 0, to exercise log/leaves textures.
  if (chunkX === 0) plantTree(chunk, 5, registry);

  return chunk;
}

function plantTree(chunk: Chunk, lx: number, registry: BlockRegistry): void {
  const log = registry.idOf('oak_log');
  const leaves = registry.idOf('oak_leaves');
  const base = surfaceHeightAt(chunk.chunkX * CHUNK_WIDTH + lx);

  for (let i = 1; i <= 4; i++) chunk.set(lx, base - i, log);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = 4; dy <= 6; dy++) {
      const x = lx + dx;
      const y = base - dy;
      if (x < 0 || x >= CHUNK_WIDTH) continue;
      if (dx === 0 && dy === 4) continue; // trunk top stays a log
      chunk.set(x, y, leaves);
    }
  }
}
