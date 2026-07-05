import { describe, it, expect } from 'vitest';
import { drainAccumulator, MAX_FRAME_TIME } from './loop';

const DT = 1 / 60;

describe('drainAccumulator', () => {
  it('runs no steps when not enough time has passed', () => {
    const r = drainAccumulator(0, DT / 2, DT);
    expect(r.steps).toBe(0);
    expect(r.accumulator).toBeCloseTo(DT / 2);
  });

  it('runs exactly one step for one dt of real time', () => {
    const r = drainAccumulator(0, DT, DT);
    expect(r.steps).toBe(1);
    expect(r.accumulator).toBeCloseTo(0);
  });

  it('carries the remainder into the accumulator', () => {
    const r = drainAccumulator(0, DT * 1.5, DT);
    expect(r.steps).toBe(1);
    expect(r.accumulator).toBeCloseTo(DT * 0.5);
  });

  it('accumulates across calls to eventually step (framerate independence)', () => {
    // Three frames of half a dt each must yield the same total sim time as
    // running the sim directly: 1.5 dt -> one step + 0.5 dt leftover.
    let acc = 0;
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const r = drainAccumulator(acc, DT / 2, DT);
      total += r.steps;
      acc = r.accumulator;
    }
    expect(total).toBe(1);
    expect(acc).toBeCloseTo(DT / 2);
  });

  it('clamps huge frame times to avoid the spiral of death', () => {
    const r = drainAccumulator(0, 10, DT);
    // 10s would be 600 steps; clamped to MAX_FRAME_TIME.
    expect(r.steps).toBe(Math.floor(MAX_FRAME_TIME / DT));
  });
});
