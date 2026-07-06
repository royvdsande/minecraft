import type { MoveInput } from '@/entity/physics';

/**
 * Keyboard input. Tracks which physical keys are down and exposes them as a
 * high-level MoveInput the simulation reads each tick. Uses `event.code`
 * (physical key) so it is layout-independent.
 */
export class Keyboard {
  private readonly down = new Set<string>();

  private static readonly LEFT = ['ArrowLeft', 'KeyA'];
  private static readonly RIGHT = ['ArrowRight', 'KeyD'];
  private static readonly JUMP = ['ArrowUp', 'KeyW', 'Space'];
  private static readonly SPRINT = ['ShiftLeft', 'ShiftRight'];

  constructor(private readonly target: Window = window) {
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Stop Space/arrows from scrolling the page.
    if (this.isBound(e.code)) e.preventDefault();
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  private isBound(code: string): boolean {
    return (
      Keyboard.LEFT.includes(code) ||
      Keyboard.RIGHT.includes(code) ||
      Keyboard.JUMP.includes(code) ||
      Keyboard.SPRINT.includes(code)
    );
  }

  private any(codes: readonly string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  get moveInput(): MoveInput {
    return {
      left: this.any(Keyboard.LEFT),
      right: this.any(Keyboard.RIGHT),
      jump: this.any(Keyboard.JUMP),
      sprint: this.any(Keyboard.SPRINT),
    };
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
  }
}
