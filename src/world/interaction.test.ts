import { describe, it, expect } from 'vitest';
import {
  withinReach,
  distanceToBlockCenter,
  blockIntersectsBody,
  canBreak,
  canPlace,
  REACH,
} from './interaction';
import type { BlockDef } from '@/blocks/block';

const W = 0.6;
const H = 1.8;

function def(over: Partial<BlockDef>): BlockDef {
  return {
    key: 'x',
    name: 'X',
    solid: true,
    textureKey: 'x',
    hardness: 1,
    drops: null,
    ...over,
  };
}

describe('reach', () => {
  it('measures distance to the block center, not its corner', () => {
    expect(distanceToBlockCenter(0.5, 0.5, 0, 0)).toBeCloseTo(0);
    expect(distanceToBlockCenter(0, 0, 0, 0)).toBeCloseTo(Math.hypot(0.5, 0.5));
  });

  it('allows nearby blocks and rejects far ones', () => {
    expect(withinReach(0.5, 0.5, 0, 0)).toBe(true);
    expect(withinReach(0.5, 0.5, 4, 0)).toBe(true); // center distance ~4 < 5
    expect(withinReach(0.5, 0.5, 20, 0)).toBe(false);
  });

  it('respects the REACH radius boundary', () => {
    // A block whose center is just beyond REACH is out.
    expect(withinReach(0, 0, REACH, 0, REACH)).toBe(false);
    expect(withinReach(0.5, 0.5, REACH - 1, 0, REACH)).toBe(true);
  });
});

describe('blockIntersectsBody', () => {
  it('detects the cell the player stands in', () => {
    // Feet-center at (5.5, 10): body spans x[5.2,5.8], y[8.2,10].
    expect(blockIntersectsBody(5, 9, 5.5, 10, W, H)).toBe(true); // torso cell
    expect(blockIntersectsBody(5, 8, 5.5, 10, W, H)).toBe(true); // head cell
  });

  it('ignores the cell just below the feet (feet rest on its top edge)', () => {
    expect(blockIntersectsBody(5, 10, 5.5, 10, W, H)).toBe(false);
  });

  it('ignores cells to the side', () => {
    expect(blockIntersectsBody(4, 9, 5.5, 10, W, H)).toBe(false);
    expect(blockIntersectsBody(6, 9, 5.5, 10, W, H)).toBe(false);
  });
});

describe('canBreak', () => {
  it('breaks normal blocks', () => {
    expect(canBreak(def({ key: 'stone', hardness: 1.5 }))).toBe(true);
  });
  it('never breaks air', () => {
    expect(canBreak(def({ key: 'air', textureKey: null, hardness: 0 }))).toBe(false);
  });
  it('never breaks unbreakable blocks (hardness < 0)', () => {
    expect(canBreak(def({ key: 'bedrock', hardness: -1 }))).toBe(false);
  });
});

describe('canPlace', () => {
  it('places a solid block into empty space away from the player', () => {
    expect(canPlace(true, true, 0, 0, 5.5, 10, W, H)).toBe(true);
  });
  it('refuses to place into an occupied cell', () => {
    expect(canPlace(false, true, 0, 0, 5.5, 10, W, H)).toBe(false);
  });
  it('refuses to place a solid block inside the player', () => {
    expect(canPlace(true, true, 5, 9, 5.5, 10, W, H)).toBe(false);
  });
  it('allows a non-solid block to overlap the player', () => {
    expect(canPlace(true, false, 5, 9, 5.5, 10, W, H)).toBe(true);
  });
});
