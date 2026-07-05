import { hashToUnit } from './prng';

/**
 * Value noise + fractal Brownian motion (fbm) over an integer lattice.
 * Deterministic given the seed; output in [0, 1). Used for terrain height,
 * biomes, and caves. Pure — no dependencies beyond the hash.
 */

/** Smoothstep easing for lattice interpolation (C1-continuous). */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinearly-interpolated value noise sampled at real coords (x, y). */
export function valueNoise2D(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);

  const v00 = hashToUnit(x0, y0, seed);
  const v10 = hashToUnit(x0 + 1, y0, seed);
  const v01 = hashToUnit(x0, y0 + 1, seed);
  const v11 = hashToUnit(x0 + 1, y0 + 1, seed);

  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
}

export interface FbmOptions {
  octaves?: number;
  lacunarity?: number;
  gain?: number;
}

/**
 * Fractal Brownian motion: sum of octaves of value noise at increasing
 * frequency and decreasing amplitude. Normalised to [0, 1).
 */
export function fbm2D(x: number, y: number, seed: number, options: FbmOptions = {}): number {
  const { octaves = 4, lacunarity = 2, gain = 0.5 } = options;
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    // Offset the seed per octave so octaves don't share the same lattice.
    sum += amplitude * valueNoise2D(x * frequency, y * frequency, seed + i * 1013);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}
