import { FIXED_DT } from './constants';

/**
 * Fixed-timestep game loop with decoupled rendering (the classic
 * "Fix Your Timestep" accumulator pattern).
 *
 * The simulation always advances in whole steps of FIXED_DT seconds, no matter
 * the display framerate, so game speed never depends on how fast we render.
 * Rendering receives an interpolation `alpha` in [0, 1) representing how far we
 * are between the last two simulated states, so motion stays smooth.
 */

/** Largest real time we let one frame represent, to avoid the "spiral of
 * death" after a long stall (e.g. a backgrounded tab). */
export const MAX_FRAME_TIME = 0.25;

/**
 * Pure accumulator step. Given the leftover accumulator plus the elapsed real
 * time, returns how many fixed steps to run and the remaining accumulator.
 * Kept pure so it can be unit-tested without a running clock.
 */
export function drainAccumulator(
  accumulator: number,
  frameTime: number,
  fixedDt: number = FIXED_DT,
): { steps: number; accumulator: number } {
  const clamped = Math.min(frameTime, MAX_FRAME_TIME);
  let acc = accumulator + clamped;
  let steps = 0;
  while (acc >= fixedDt) {
    acc -= fixedDt;
    steps++;
  }
  return { steps, accumulator: acc };
}

export interface LoopCallbacks {
  /** Advance the simulation by exactly FIXED_DT seconds. */
  update: (dt: number) => void;
  /** Draw the world. `alpha` in [0,1) interpolates between sim states. */
  render: (alpha: number) => void;
}

/** requestAnimationFrame-driven loop wrapping the pure accumulator. */
export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  constructor(private readonly cb: LoopCallbacks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const frameTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    const { steps, accumulator } = drainAccumulator(this.accumulator, frameTime);
    for (let i = 0; i < steps; i++) {
      this.cb.update(FIXED_DT);
    }
    this.accumulator = accumulator;

    this.cb.render(this.accumulator / FIXED_DT);
    this.rafId = requestAnimationFrame(this.frame);
  };
}
