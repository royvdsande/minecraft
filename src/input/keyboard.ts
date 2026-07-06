import type { MoveInput } from '@/entity/physics';

/**
 * Keyboard input. Tracks which physical keys are down and exposes them as a
 * high-level MoveInput the simulation reads each tick. Uses `event.code`
 * (physical key) so it is layout-independent.
 */
export class Keyboard {
  private readonly state = new KeyboardState();

  constructor(private readonly target: Window = window) {
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Stop Space from scrolling and prevent Ctrl+W from closing the tab while sprinting.
    if (this.state.isBound(e.code)) e.preventDefault();
    this.state.keyDown(e.code, e.timeStamp, e.repeat);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.state.keyUp(e.code);
  };

  get moveInput(): MoveInput {
    return this.state.moveInput;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
  }
}

export const DOUBLE_TAP_SPRINT_MS = 280;

const LEFT = ['KeyS'] as const;
const RIGHT = ['KeyW'] as const;
const JUMP = ['Space'] as const;
const SPRINT_HOLD = ['ControlLeft', 'ControlRight'] as const;
const MOVEMENT = [...LEFT, ...RIGHT] as const;

export class KeyboardState {
  private readonly down = new Set<string>();
  private readonly lastTapAt = new Map<string, number>();
  private sprintLatchCode: string | null = null;

  keyDown(code: string, timeMs: number, repeat: boolean = false): void {
    const wasDown = this.down.has(code);
    this.down.add(code);
    if (repeat || wasDown || !isMovement(code)) return;

    const previousTap = this.lastTapAt.get(code);
    if (previousTap !== undefined && timeMs - previousTap <= DOUBLE_TAP_SPRINT_MS) {
      this.sprintLatchCode = code;
    }
    this.lastTapAt.set(code, timeMs);
  }

  keyUp(code: string): void {
    this.down.delete(code);
    if (this.sprintLatchCode === code) this.sprintLatchCode = null;
  }

  isBound(code: string): boolean {
    return (
      includes(LEFT, code) ||
      includes(RIGHT, code) ||
      includes(JUMP, code) ||
      includes(SPRINT_HOLD, code)
    );
  }

  get moveInput(): MoveInput {
    return {
      left: this.any(LEFT),
      right: this.any(RIGHT),
      jump: this.any(JUMP),
      sprint: this.any(SPRINT_HOLD) || this.latchedSprintIsHeld(),
    };
  }

  private any(codes: readonly string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  private latchedSprintIsHeld(): boolean {
    return this.sprintLatchCode !== null && this.down.has(this.sprintLatchCode);
  }
}

function isMovement(code: string): boolean {
  return includes(MOVEMENT, code);
}

function includes(codes: readonly string[], code: string): boolean {
  return codes.includes(code);
}
