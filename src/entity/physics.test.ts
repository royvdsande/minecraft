import { describe, it, expect } from 'vitest';
import {
  stepPhysics,
  moveX,
  moveY,
  GRAVITY,
  JUMP_SPEED,
  MOVE_SPEED,
  MAX_FALL_SPEED,
  type Kinematic,
  type MoveInput,
} from './physics';

const W = 0.6;
const H = 1.8;
const NO_INPUT: MoveInput = { left: false, right: false, jump: false };

/** Solid = a floor at row `floorY` and everywhere below it. */
function floorAt(floorY: number) {
  return (_bx: number, by: number) => by >= floorY;
}

/** Solid = a full vertical wall at column `wallX`. */
function wallAt(wallX: number) {
  return (bx: number, _by: number) => bx === wallX;
}

function fall(
  k: Kinematic,
  isSolid: (bx: number, by: number) => boolean,
  ticks: number,
): Kinematic {
  let s = k;
  for (let i = 0; i < ticks; i++) s = stepPhysics(s, W, H, NO_INPUT, 1 / 60, isSolid);
  return s;
}

describe('moveX', () => {
  it('passes through empty space', () => {
    const r = moveX(0, 0, W, H, 0.1, () => false);
    expect(r.hit).toBe(false);
    expect(r.x).toBeCloseTo(0.1);
  });

  it('stops flush against a wall on the right', () => {
    // Right edge starts at 5.8, moves into the wall at column 6.
    const r = moveX(5.2, 0, W, H, 0.5, wallAt(6));
    expect(r.hit).toBe(true);
    expect(r.x + W).toBeCloseTo(6); // right edge touches the wall face
  });

  it('stops flush against a wall on the left', () => {
    // Left edge starts at 7.2 (col 7), moves into the wall at column 6.
    const r = moveX(7.2, 0, W, H, -0.4, wallAt(6));
    expect(r.hit).toBe(true);
    expect(r.x).toBeCloseTo(7); // left edge touches the right face of col 6
  });
});

describe('moveY', () => {
  it('lands flush on top of the floor', () => {
    const r = moveY(0, 8, W, H, 0.5, floorAt(10));
    expect(r.hit).toBe(true);
    expect(r.y + H).toBeCloseTo(10); // feet rest on the floor top
  });

  it('bonks a ceiling when moving up', () => {
    const r = moveY(0, 5, W, H, -0.5, (_bx, by) => by <= 4);
    expect(r.hit).toBe(true);
    expect(r.y).toBeCloseTo(5); // head touches the bottom face of row 4
  });
});

describe('stepPhysics', () => {
  it('accelerates downward under gravity in open air', () => {
    const s = stepPhysics(
      { x: 0, y: 0, vx: 0, vy: 0, grounded: false },
      W,
      H,
      NO_INPUT,
      1 / 60,
      () => false,
    );
    expect(s.vy).toBeCloseTo(GRAVITY / 60);
    expect(s.y).toBeGreaterThan(0); // moved down (+Y)
    expect(s.grounded).toBe(false);
  });

  it('caps fall speed at MAX_FALL_SPEED', () => {
    const s = fall({ x: 0, y: 0, vx: 0, vy: 0, grounded: false }, () => false, 600);
    expect(s.vy).toBeLessThanOrEqual(MAX_FALL_SPEED + 1e-6);
  });

  it('falls and comes to rest exactly on top of the floor', () => {
    const s = fall({ x: 0.5, y: 0, vx: 0, vy: 0, grounded: false }, floorAt(10), 300);
    expect(s.y).toBeCloseTo(10); // feet on the floor surface (row 10 top)
    expect(s.grounded).toBe(true);
    expect(s.vy).toBe(0);
  });

  it('does not sink through the floor even at terminal velocity', () => {
    const s = fall({ x: 0.5, y: -100, vx: 0, vy: 0, grounded: false }, floorAt(10), 600);
    expect(s.y).toBeLessThanOrEqual(10 + 1e-6);
    expect(s.grounded).toBe(true);
  });

  it('walks right at MOVE_SPEED when grounded', () => {
    const start: Kinematic = { x: 0.5, y: 10, vx: 0, vy: 0, grounded: true };
    const s = stepPhysics(
      start,
      W,
      H,
      { left: false, right: true, jump: false },
      1 / 60,
      floorAt(10),
    );
    expect(s.vx).toBeCloseTo(MOVE_SPEED);
    expect(s.x).toBeGreaterThan(0.5);
  });

  it('cannot walk through a wall', () => {
    let s: Kinematic = { x: 5.5, y: 10, vx: 0, vy: 0, grounded: true };
    const solid = (bx: number, by: number) => by >= 11 || bx === 7;
    for (let i = 0; i < 120; i++) {
      s = stepPhysics(s, W, H, { left: false, right: true, jump: false }, 1 / 60, solid);
    }
    expect(s.x + W / 2).toBeLessThanOrEqual(7 + 1e-6); // never past the wall
  });

  it('jumps upward only when grounded, then lands again', () => {
    const isSolid = floorAt(10);
    let s: Kinematic = { x: 0.5, y: 10, vx: 0, vy: 0, grounded: true };

    // First tick with jump held: moves upward.
    s = stepPhysics(s, W, H, { left: false, right: false, jump: true }, 1 / 60, isSolid);
    expect(s.vy).toBeLessThan(0);
    expect(s.grounded).toBe(false);

    // A mid-air jump does nothing (still rising or falling, not grounded).
    const airborneVy = s.vy;
    s = stepPhysics(s, W, H, { left: false, right: false, jump: true }, 1 / 60, isSolid);
    expect(s.vy).toBeGreaterThan(airborneVy); // gravity only, no re-launch

    // Let it fall back; it lands on the floor and is grounded again.
    let peak = s.y;
    for (let i = 0; i < 300; i++) {
      s = stepPhysics(s, W, H, NO_INPUT, 1 / 60, isSolid);
      peak = Math.min(peak, s.y);
    }
    expect(peak).toBeLessThan(10 - 1); // rose at least ~1 block above ground
    expect(s.y).toBeCloseTo(10);
    expect(s.grounded).toBe(true);
  });

  it('reaches a jump height consistent with the tuning', () => {
    const isSolid = floorAt(10);
    let s: Kinematic = { x: 0.5, y: 10, vx: 0, vy: 0, grounded: true };
    s = stepPhysics(s, W, H, { left: false, right: false, jump: true }, 1 / 60, isSolid);
    let peak = s.y;
    for (let i = 0; i < 300; i++) {
      s = stepPhysics(s, W, H, NO_INPUT, 1 / 60, isSolid);
      peak = Math.min(peak, s.y);
    }
    const height = 10 - peak;
    const expected = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
    expect(height).toBeGreaterThan(expected - 0.4);
    expect(height).toBeLessThan(expected + 0.4);
  });
});
