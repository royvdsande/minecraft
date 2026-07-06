import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_SPRINT_MS, KeyboardState } from './keyboard';

describe('KeyboardState', () => {
  it('maps W to right, S to left, and Space to jump', () => {
    const keyboard = new KeyboardState();

    keyboard.keyDown('KeyW', 0);
    keyboard.keyDown('Space', 0);
    expect(keyboard.moveInput).toEqual({
      left: false,
      right: true,
      jump: true,
      sprint: false,
    });

    keyboard.keyUp('KeyW');
    keyboard.keyDown('KeyS', 10);
    expect(keyboard.moveInput).toEqual({
      left: true,
      right: false,
      jump: true,
      sprint: false,
    });
  });

  it('sprints while Control is held', () => {
    const keyboard = new KeyboardState();

    keyboard.keyDown('ControlLeft', 0);
    expect(keyboard.moveInput.sprint).toBe(true);

    keyboard.keyUp('ControlLeft');
    expect(keyboard.moveInput.sprint).toBe(false);
  });

  it('double-tap sprints until the movement key is released', () => {
    const keyboard = new KeyboardState();

    keyboard.keyDown('KeyW', 0);
    keyboard.keyUp('KeyW');
    keyboard.keyDown('KeyW', DOUBLE_TAP_SPRINT_MS - 1);

    expect(keyboard.moveInput.right).toBe(true);
    expect(keyboard.moveInput.sprint).toBe(true);

    keyboard.keyUp('KeyW');
    expect(keyboard.moveInput.sprint).toBe(false);
  });

  it('does not sprint when the second tap is too late', () => {
    const keyboard = new KeyboardState();

    keyboard.keyDown('KeyS', 0);
    keyboard.keyUp('KeyS');
    keyboard.keyDown('KeyS', DOUBLE_TAP_SPRINT_MS + 1);

    expect(keyboard.moveInput.left).toBe(true);
    expect(keyboard.moveInput.sprint).toBe(false);
  });

  it('ignores key repeat for double-tap sprint', () => {
    const keyboard = new KeyboardState();

    keyboard.keyDown('KeyW', 0);
    keyboard.keyDown('KeyW', 50, true);

    expect(keyboard.moveInput.right).toBe(true);
    expect(keyboard.moveInput.sprint).toBe(false);
  });
});
