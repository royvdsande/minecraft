import { describe, expect, it } from 'vitest';
import { miningDuration, miningStage, stepMining, type MiningTarget } from './mining';

const STONE: MiningTarget = { bx: 4, by: 8, blockId: 1 };
const DIRT: MiningTarget = { bx: 4, by: 8, blockId: 2 };

describe('mining', () => {
  it('requires hold time before completing a break', () => {
    const first = stepMining(null, { dt: 0.5, mining: true, target: STONE, hardness: 1.5 });
    expect(first.completed).toBe(false);
    expect(first.state?.progress).toBeCloseTo(1 / 3);

    const second = stepMining(first.state, {
      dt: 1,
      mining: true,
      target: STONE,
      hardness: 1.5,
    });
    expect(second.completed).toBe(true);
    expect(second.state?.progress).toBe(1);
  });

  it('resets progress when the mined target changes', () => {
    const first = stepMining(null, { dt: 0.75, mining: true, target: STONE, hardness: 1.5 });
    const second = stepMining(first.state, {
      dt: 0.1,
      mining: true,
      target: DIRT,
      hardness: 0.5,
    });

    expect(second.state?.target).toEqual(DIRT);
    expect(second.state?.elapsed).toBeCloseTo(0.1);
  });

  it('clears progress when mining stops or block is unbreakable', () => {
    const started = stepMining(null, { dt: 0.2, mining: true, target: STONE, hardness: 1 });

    expect(
      stepMining(started.state, { dt: 0.2, mining: false, target: STONE, hardness: 1 }).state,
    ).toBeNull();
    expect(
      stepMining(started.state, { dt: 0.2, mining: true, target: STONE, hardness: -1 }).state,
    ).toBeNull();
  });

  it('clamps duration and animation stages', () => {
    expect(miningDuration(0)).toBe(0.25);
    expect(miningDuration(99)).toBe(6);
    expect(miningStage(0)).toBe(0);
    expect(miningStage(0.99)).toBe(9);
    expect(miningStage(1)).toBe(9);
    expect(() => miningStage(0.5, 0)).toThrow(RangeError);
  });
});
