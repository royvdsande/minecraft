import { describe, it, expect } from 'vitest';
import { valueNoise2D, fbm2D } from './noise';
import { hashToUnit, saltSeed } from './prng';

describe('hashToUnit', () => {
  it('is deterministic', () => {
    expect(hashToUnit(12, 34, 7)).toBe(hashToUnit(12, 34, 7));
  });

  it('stays in [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const v = hashToUnit(i * 7 - 200, i * 13 - 50, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('varies with each input and the seed', () => {
    expect(hashToUnit(1, 0, 0)).not.toBe(hashToUnit(2, 0, 0));
    expect(hashToUnit(0, 1, 0)).not.toBe(hashToUnit(0, 2, 0));
    expect(hashToUnit(1, 1, 0)).not.toBe(hashToUnit(1, 1, 1));
  });

  it('is roughly uniform on average', () => {
    let sum = 0;
    const n = 4000;
    for (let i = 0; i < n; i++) sum += hashToUnit(i, i * 3, 99);
    expect(sum / n).toBeGreaterThan(0.45);
    expect(sum / n).toBeLessThan(0.55);
  });
});

describe('saltSeed', () => {
  it('is deterministic and salt-dependent', () => {
    expect(saltSeed(5, 'cave')).toBe(saltSeed(5, 'cave'));
    expect(saltSeed(5, 'cave')).not.toBe(saltSeed(5, 'biome'));
  });
});

describe('valueNoise2D', () => {
  it('is deterministic and in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = valueNoise2D(i * 0.3, i * 0.11, 3);
      expect(v).toBe(valueNoise2D(i * 0.3, i * 0.11, 3));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('returns exact lattice values at integer coords', () => {
    expect(valueNoise2D(5, 8, 1)).toBeCloseTo(hashToUnit(5, 8, 1));
  });

  it('is continuous: nearby samples are close', () => {
    const a = valueNoise2D(10, 10, 2);
    const b = valueNoise2D(10.01, 10, 2);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });
});

describe('fbm2D', () => {
  it('is deterministic and stays in [0, 1)', () => {
    for (let i = 0; i < 300; i++) {
      const v = fbm2D(i * 0.05, 0, 8, { octaves: 5 });
      expect(v).toBe(fbm2D(i * 0.05, 0, 8, { octaves: 5 }));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
