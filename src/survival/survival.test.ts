import { describe, expect, it } from 'vitest';
import {
  DAY_LENGTH_SECONDS,
  MAX_HEALTH,
  MAX_HUNGER,
  applyFallDamage,
  createSurvivalState,
  dayPhaseLabel,
  nightOverlayAlpha,
  stepSurvival,
} from './survival';

describe('survival state', () => {
  it('starts alive, fed, healthy, and near noon', () => {
    expect(createSurvivalState()).toEqual({
      health: MAX_HEALTH,
      hunger: MAX_HUNGER,
      starvationTimer: 0,
      dayTime: DAY_LENGTH_SECONDS / 4,
      fallStartY: null,
      alive: true,
    });
  });

  it('drains hunger faster while moving', () => {
    const state = createSurvivalState();
    const idle = stepSurvival(state, { dt: 10, y: 0, vy: 0, grounded: true, moving: false });
    const moving = stepSurvival(state, { dt: 10, y: 0, vy: 0, grounded: true, moving: true });

    expect(moving.hunger).toBeLessThan(idle.hunger);
    expect(idle.hunger).toBeLessThan(MAX_HUNGER);
  });

  it('starves only after hunger is empty', () => {
    const hungry = { ...createSurvivalState(), hunger: 0 };
    const beforeDamage = stepSurvival(hungry, {
      dt: 3.9,
      y: 0,
      vy: 0,
      grounded: true,
      moving: false,
    });
    const afterDamage = stepSurvival(hungry, {
      dt: 4.1,
      y: 0,
      vy: 0,
      grounded: true,
      moving: false,
    });

    expect(beforeDamage.health).toBe(MAX_HEALTH);
    expect(afterDamage.health).toBe(MAX_HEALTH - 1);
  });

  it('tracks falling from the highest point and clears on landing', () => {
    const falling = stepSurvival(createSurvivalState(), {
      dt: 1,
      y: 10,
      vy: 12,
      grounded: false,
      moving: false,
    });
    const stillFalling = stepSurvival(falling, {
      dt: 1,
      y: 12,
      vy: 12,
      grounded: false,
      moving: false,
    });
    const landed = stepSurvival(stillFalling, {
      dt: 1,
      y: 16,
      vy: 0,
      grounded: true,
      moving: false,
    });

    expect(stillFalling.fallStartY).toBe(10);
    expect(landed.fallStartY).toBeNull();
    expect(landed.health).toBe(MAX_HEALTH - 3);
  });

  it('does not damage safe falls and clamps lethal falls', () => {
    expect(applyFallDamage(MAX_HEALTH, 3)).toBe(MAX_HEALTH);
    expect(applyFallDamage(MAX_HEALTH, 4)).toBe(MAX_HEALTH - 1);
    expect(applyFallDamage(2, 20)).toBe(0);
  });

  it('wraps day time and computes night darkness', () => {
    const wrapped = stepSurvival(createSurvivalState(), {
      dt: DAY_LENGTH_SECONDS,
      y: 0,
      vy: 0,
      grounded: true,
      moving: false,
    });

    expect(wrapped.dayTime).toBe(DAY_LENGTH_SECONDS / 4);
    expect(nightOverlayAlpha(DAY_LENGTH_SECONDS / 4)).toBeCloseTo(0);
    expect(nightOverlayAlpha((DAY_LENGTH_SECONDS * 3) / 4)).toBeGreaterThan(0.6);
    expect(dayPhaseLabel(DAY_LENGTH_SECONDS / 4)).toBe('day');
    expect(dayPhaseLabel((DAY_LENGTH_SECONDS * 3) / 4)).toBe('night');
  });
});
