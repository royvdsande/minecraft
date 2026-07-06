import type { BlockId } from '@/blocks/block';

export interface MiningTarget {
  readonly bx: number;
  readonly by: number;
  readonly blockId: BlockId;
}

export interface MiningState {
  readonly target: MiningTarget;
  readonly elapsed: number;
  readonly progress: number;
}

export interface MiningStepInput {
  readonly dt: number;
  readonly mining: boolean;
  readonly target: MiningTarget | null;
  readonly hardness: number;
}

export interface MiningStepResult {
  readonly state: MiningState | null;
  readonly completed: boolean;
}

const MIN_BREAK_SECONDS = 0.25;
const MAX_BREAK_SECONDS = 6;

export function stepMining(
  state: MiningState | null,
  input: MiningStepInput,
): MiningStepResult {
  if (!input.mining || !input.target || input.hardness < 0) {
    return { state: null, completed: false };
  }

  const duration = miningDuration(input.hardness);
  const sameTarget = state !== null && targetsEqual(state.target, input.target);
  const elapsed = (sameTarget ? state.elapsed : 0) + Math.max(0, input.dt);
  const progress = clamp01(elapsed / duration);

  return {
    state: {
      target: input.target,
      elapsed,
      progress,
    },
    completed: progress >= 1,
  };
}

export function miningDuration(hardness: number): number {
  if (hardness < 0) return Number.POSITIVE_INFINITY;
  return Math.min(MAX_BREAK_SECONDS, Math.max(MIN_BREAK_SECONDS, hardness));
}

export function miningStage(progress: number, stages: number = 10): number {
  if (!Number.isInteger(stages) || stages <= 0) {
    throw new RangeError(`Mining stages must be a positive integer: ${stages}`);
  }
  return Math.min(stages - 1, Math.max(0, Math.floor(clamp01(progress) * stages)));
}

function targetsEqual(a: MiningTarget, b: MiningTarget): boolean {
  return a.bx === b.bx && a.by === b.by && a.blockId === b.blockId;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
