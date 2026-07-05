/**
 * Deterministic hashing for procedural generation. No global mutable state:
 * every value is a pure function of its integer inputs plus the world seed, so
 * generation is fully reproducible and can be produced per-chunk in any order.
 */

/**
 * Hash two integer lattice coordinates + seed to a uniform float in [0, 1).
 * Based on integer avalanche mixing (xxhash-style multiplies/xors).
 */
export function hashToUnit(x: number, y: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (y | 0), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 13;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Fold a short string (a "salt") into a 32-bit integer to derive sub-seeds. */
export function saltSeed(seed: number, salt: string): number {
  let h = seed | 0;
  for (let i = 0; i < salt.length; i++) {
    h = Math.imul(h ^ salt.charCodeAt(i), 0x01000193);
  }
  return h | 0;
}
