import { WORLD_HEIGHT, CHUNK_WIDTH } from '@/core/constants';
import { Chunk } from '@/world/chunk';
import { AIR, type BlockRegistry } from '@/blocks/registry';
import type { BlockId } from '@/blocks/block';
import { fbm2D } from './noise';
import { hashToUnit, saltSeed } from './prng';

/**
 * Seeded, deterministic terrain generation (M4). Same seed + same chunkX ⇒
 * byte-identical chunk, produced independently of neighbours. Pure aside from
 * reading block ids out of the registry.
 *
 * Layers: surface height from fbm; grass/sand biomes; water pools below sea
 * level; dirt/sand soil over stone; 2D-noise caves; sprinkled ores; oak trees
 * painted with neighbour awareness so canopies never clip at chunk borders.
 */

/** Y of the water surface. Ground below this (larger y) floods with water. */
export const SEA_LEVEL = 100;

const BASE_SURFACE = 92; // mean ground-top y (above sea ⇒ mostly land)
const AMPLITUDE = 26; // ± variation of the surface
const SOIL_DEPTH = 4; // dirt/sand thickness over stone
const TERRAIN_FREQ = 1 / 96; // horizontal scale of hills
const BIOME_FREQ = 1 / 160;
const CAVE_FREQ = 1 / 22;
const CAVE_THRESHOLD = 0.07; // half-width of the carved noise band
const TREE_CHANCE = 0.09;
const CANOPY_RADIUS = 2;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

interface TerrainBlockIds {
  grass: BlockId;
  dirt: BlockId;
  stone: BlockId;
  sand: BlockId;
  gravel: BlockId;
  bedrock: BlockId;
  coal: BlockId;
  iron: BlockId;
  water: BlockId;
  log: BlockId;
  leaves: BlockId;
}

export class TerrainGenerator {
  private readonly ids: TerrainBlockIds;
  private readonly caveSeed: number;
  private readonly biomeSeed: number;
  private readonly oreSeed: number;
  private readonly treeSeed: number;

  constructor(
    readonly seed: number,
    registry: BlockRegistry,
  ) {
    const id = (key: string): BlockId => registry.idOf(key);
    this.ids = {
      grass: id('grass_block'),
      dirt: id('dirt'),
      stone: id('stone'),
      sand: id('sand'),
      gravel: id('gravel'),
      bedrock: id('bedrock'),
      coal: id('coal_ore'),
      iron: id('iron_ore'),
      water: id('water'),
      log: id('oak_log'),
      leaves: id('oak_leaves'),
    };
    this.caveSeed = saltSeed(seed, 'cave');
    this.biomeSeed = saltSeed(seed, 'biome');
    this.oreSeed = saltSeed(seed, 'ore');
    this.treeSeed = saltSeed(seed, 'tree');
  }

  /** Ground-top block y at world column bx (top of the surface block). */
  surfaceHeight(bx: number): number {
    const n = fbm2D(bx * TERRAIN_FREQ, 0, this.seed, { octaves: 5 });
    return clamp(Math.round(BASE_SURFACE + (n - 0.5) * 2 * AMPLITUDE), 8, WORLD_HEIGHT - 8);
  }

  private isDesert(bx: number): boolean {
    return fbm2D(bx * BIOME_FREQ, 0, this.biomeSeed, { octaves: 3 }) > 0.62;
  }

  private isCave(bx: number, by: number): boolean {
    const n = fbm2D(bx * CAVE_FREQ, by * CAVE_FREQ, this.caveSeed, { octaves: 3 });
    return Math.abs(n - 0.5) < CAVE_THRESHOLD;
  }

  /** Raw per-column tree candidacy (before spacing) — plains land only. */
  private treeCandidate(bx: number): boolean {
    const surfaceY = this.surfaceHeight(bx);
    if (surfaceY >= SEA_LEVEL - 1) return false; // not underwater / on beach
    if (this.isDesert(bx)) return false;
    return hashToUnit(bx, 0, this.treeSeed) < TREE_CHANCE;
  }

  /** A tree trunk sits here if it's a candidate and its left neighbours aren't
   * (enforces a minimum spacing, deterministically). */
  private hasTree(bx: number): boolean {
    return this.treeCandidate(bx) && !this.treeCandidate(bx - 1) && !this.treeCandidate(bx - 2);
  }

  generateChunk(chunkX: number): Chunk {
    const chunk = new Chunk(chunkX);
    const startBx = chunkX * CHUNK_WIDTH;

    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      this.fillColumn(chunk, startBx + lx, lx);
    }

    // Paint trees whose trunk lies within this chunk OR near enough that their
    // canopy reaches in — so cross-boundary trees stay whole and identical.
    for (let bx = startBx - CANOPY_RADIUS; bx < startBx + CHUNK_WIDTH + CANOPY_RADIUS; bx++) {
      if (this.hasTree(bx)) this.paintTree(chunk, startBx, bx);
    }

    return chunk;
  }

  private fillColumn(chunk: Chunk, bx: number, lx: number): void {
    const surfaceY = this.surfaceHeight(bx);
    const submerged = surfaceY > SEA_LEVEL;
    const beach = Math.abs(surfaceY - SEA_LEVEL) <= 2;
    const sandy = this.isDesert(bx) || beach || submerged;

    const topBlock = sandy ? this.ids.sand : this.ids.grass;
    const soilBlock = sandy ? this.ids.sand : this.ids.dirt;

    for (let y = 0; y < WORLD_HEIGHT; y++) {
      let id: BlockId;

      if (y < surfaceY) {
        // Above ground: water at/below sea level, else air.
        id = y >= SEA_LEVEL ? this.ids.water : AIR;
      } else if (y === surfaceY) {
        id = topBlock;
      } else if (y < surfaceY + SOIL_DEPTH) {
        id = soilBlock;
      } else if (y >= WORLD_HEIGHT - 1) {
        id = this.ids.bedrock;
      } else if (y >= WORLD_HEIGHT - 4 && hashToUnit(bx, y, this.seed) < 0.5) {
        id = this.ids.bedrock; // rough bedrock band
      } else {
        id = this.stoneOrCave(bx, y);
      }

      if (id !== AIR) chunk.set(lx, y, id);
    }
  }

  /** Stone with caves carved out and occasional ores. */
  private stoneOrCave(bx: number, by: number): BlockId {
    if (this.isCave(bx, by)) return AIR;

    const o = hashToUnit(bx, by, this.oreSeed);
    if (o < 0.014) return this.ids.coal;
    if (by > SEA_LEVEL + 24 && o > 0.99) return this.ids.iron;
    if (o > 0.985) return this.ids.gravel;
    return this.ids.stone;
  }

  private paintTree(chunk: Chunk, startBx: number, tx: number): void {
    const surfaceY = this.surfaceHeight(tx);
    const trunkHeight = 4 + Math.floor(hashToUnit(tx, 1, this.treeSeed) * 3); // 4-6
    const topY = surfaceY - trunkHeight;

    // Canopy: a small blob of leaves around the trunk top (air only).
    for (let dx = -CANOPY_RADIUS; dx <= CANOPY_RADIUS; dx++) {
      for (let dy = -CANOPY_RADIUS; dy <= CANOPY_RADIUS; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > CANOPY_RADIUS + 1) continue; // rounded
        this.place(chunk, startBx, tx + dx, topY + dy, this.ids.leaves, false);
      }
    }
    // Trunk (overwrites leaves so the stem is solid).
    for (let y = surfaceY - 1; y >= topY; y--) {
      this.place(chunk, startBx, tx, y, this.ids.log, true);
    }
  }

  /** Set a block if (bx,by) falls inside this chunk. `force` overwrites
   * non-air; otherwise only air is replaced (so leaves don't erase terrain). */
  private place(
    chunk: Chunk,
    startBx: number,
    bx: number,
    by: number,
    id: BlockId,
    force: boolean,
  ): void {
    const lx = bx - startBx;
    if (lx < 0 || lx >= CHUNK_WIDTH || by < 0 || by >= WORLD_HEIGHT) return;
    if (!force && chunk.get(lx, by) !== AIR) return;
    chunk.set(lx, by, id);
  }
}
