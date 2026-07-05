import { describe, it, expect } from 'vitest';
import { TerrainGenerator, SEA_LEVEL } from './terrain';
import { createBlockRegistry, AIR } from '@/blocks/registry';
import { WORLD_HEIGHT, CHUNK_WIDTH } from '@/core/constants';

const registry = createBlockRegistry();
const solidAtBottom = registry.idOf('bedrock');

describe('TerrainGenerator', () => {
  it('is deterministic: same seed + chunkX ⇒ identical blocks', () => {
    const a = new TerrainGenerator(1234, registry).generateChunk(3);
    const b = new TerrainGenerator(1234, registry).generateChunk(3);
    expect(a.blocks).toEqual(b.blocks);
  });

  it('differs between seeds and between chunks', () => {
    const g = new TerrainGenerator(1234, registry);
    expect(g.generateChunk(0).blocks).not.toEqual(g.generateChunk(1).blocks);
    const other = new TerrainGenerator(9999, registry);
    expect(g.generateChunk(0).blocks).not.toEqual(other.generateChunk(0).blocks);
  });

  it('places the surface block as the topmost non-air (or water) column cell', () => {
    const g = new TerrainGenerator(42, registry);
    const chunk = g.generateChunk(0);
    const water = registry.idOf('water');
    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      const surfaceY = g.surfaceHeight(lx);
      // Everything strictly above the surface is air or water, never solid soil.
      for (let y = 0; y < surfaceY; y++) {
        const id = chunk.get(lx, y);
        expect(id === AIR || id === water).toBe(true);
      }
      // The surface cell itself is filled (solid ground or seabed).
      expect(chunk.get(lx, surfaceY)).not.toBe(AIR);
    }
  });

  it('bottoms out in bedrock across the whole chunk', () => {
    const chunk = new TerrainGenerator(7, registry).generateChunk(-2);
    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      expect(chunk.get(lx, WORLD_HEIGHT - 1)).toBe(solidAtBottom);
    }
  });

  it('fills open cells at/below sea level with water where the ground dips low', () => {
    // Scan many chunks for at least one submerged column and verify water fills
    // from sea level down to the seabed.
    const g = new TerrainGenerator(2024, registry);
    const water = registry.idOf('water');
    let sawWater = false;
    for (let cx = -6; cx <= 6 && !sawWater; cx++) {
      const chunk = g.generateChunk(cx);
      for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
        const surfaceY = g.surfaceHeight(cx * CHUNK_WIDTH + lx);
        if (surfaceY > SEA_LEVEL) {
          expect(chunk.get(lx, SEA_LEVEL)).toBe(water);
          expect(chunk.get(lx, surfaceY - 1)).toBe(water);
          sawWater = true;
          break;
        }
      }
    }
    expect(sawWater).toBe(true);
  });

  it('never puts water above sea level', () => {
    const g = new TerrainGenerator(555, registry);
    const water = registry.idOf('water');
    for (let cx = -2; cx <= 2; cx++) {
      const chunk = g.generateChunk(cx);
      for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
        for (let y = 0; y < SEA_LEVEL; y++) {
          expect(chunk.get(lx, y)).not.toBe(water);
        }
      }
    }
  });

  it('carves at least some caves (air pockets below the surface)', () => {
    const g = new TerrainGenerator(321, registry);
    let airPockets = 0;
    for (let cx = 0; cx < 4; cx++) {
      const chunk = g.generateChunk(cx);
      for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
        const surfaceY = g.surfaceHeight(cx * CHUNK_WIDTH + lx);
        for (let y = surfaceY + 8; y < WORLD_HEIGHT - 6; y++) {
          if (chunk.get(lx, y) === AIR) airPockets++;
        }
      }
    }
    expect(airPockets).toBeGreaterThan(0);
  });
});
