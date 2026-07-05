export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;
export const DAY_LENGTH_SECONDS = 240;
export const SAFE_FALL_DISTANCE = 3;

const IDLE_HUNGER_DRAIN_PER_SECOND = 1 / 180;
const MOVING_HUNGER_DRAIN_PER_SECOND = 1 / 90;
const STARVATION_DAMAGE_INTERVAL = 4;

export interface SurvivalState {
  readonly health: number;
  readonly hunger: number;
  readonly starvationTimer: number;
  readonly dayTime: number;
  readonly fallStartY: number | null;
  readonly alive: boolean;
}

export interface SurvivalStepInput {
  readonly dt: number;
  readonly y: number;
  readonly vy: number;
  readonly grounded: boolean;
  readonly moving: boolean;
}

export function createSurvivalState(): SurvivalState {
  return {
    health: MAX_HEALTH,
    hunger: MAX_HUNGER,
    starvationTimer: 0,
    dayTime: DAY_LENGTH_SECONDS / 4, // start around noon
    fallStartY: null,
    alive: true,
  };
}

export function stepSurvival(
  state: Readonly<SurvivalState>,
  input: SurvivalStepInput,
): SurvivalState {
  if (input.dt < 0 || !Number.isFinite(input.dt)) {
    throw new RangeError(`dt must be a non-negative finite number: ${input.dt}`);
  }

  let health = clamp(state.health, 0, MAX_HEALTH);
  let hunger = clamp(state.hunger, 0, MAX_HUNGER);
  let starvationTimer = Math.max(0, state.starvationTimer);
  let fallStartY = state.fallStartY;

  const dayTime = wrapTime(state.dayTime + input.dt);

  if (health > 0) {
    const hungerDrain =
      (IDLE_HUNGER_DRAIN_PER_SECOND + (input.moving ? MOVING_HUNGER_DRAIN_PER_SECOND : 0)) *
      input.dt;
    hunger = Math.max(0, hunger - hungerDrain);

    if (hunger <= 0) {
      starvationTimer += input.dt;
      while (starvationTimer >= STARVATION_DAMAGE_INTERVAL && health > 0) {
        health = Math.max(0, health - 1);
        starvationTimer -= STARVATION_DAMAGE_INTERVAL;
      }
    } else {
      starvationTimer = 0;
    }

    if (input.grounded) {
      if (fallStartY !== null) {
        health = applyFallDamage(health, input.y - fallStartY);
      }
      fallStartY = null;
    } else if (input.vy > 0) {
      fallStartY = fallStartY === null ? input.y : Math.min(fallStartY, input.y);
    }
  }

  return {
    health,
    hunger,
    starvationTimer,
    dayTime,
    fallStartY,
    alive: health > 0,
  };
}

export function applyFallDamage(health: number, fallDistance: number): number {
  const damage = Math.max(0, Math.floor(fallDistance - SAFE_FALL_DISTANCE));
  return clamp(health - damage, 0, MAX_HEALTH);
}

export function nightOverlayAlpha(dayTime: number): number {
  const normalized = wrapTime(dayTime) / DAY_LENGTH_SECONDS;
  const daylight = Math.max(0, Math.sin(normalized * Math.PI * 2));
  return 0.62 * (1 - daylight);
}

export function dayPhaseLabel(dayTime: number): string {
  const normalized = wrapTime(dayTime) / DAY_LENGTH_SECONDS;
  if (normalized < 0.125 || normalized >= 0.875) return 'dawn';
  if (normalized < 0.375) return 'day';
  if (normalized < 0.625) return 'dusk';
  return 'night';
}

function wrapTime(seconds: number): number {
  return ((seconds % DAY_LENGTH_SECONDS) + DAY_LENGTH_SECONDS) % DAY_LENGTH_SECONDS;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
