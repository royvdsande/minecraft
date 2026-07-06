import { describe, expect, it } from 'vitest';
import {
  DESPAWN_SECONDS,
  ItemDropManager,
  PICKUP_DELAY,
  stepDrop,
  type ItemDrop,
} from './item-drop';

const FLOOR_Y = 10; // solid row: everything at by >= 10

function isSolid(_bx: number, by: number): boolean {
  return by >= FLOOR_Y;
}

function drop(overrides: Partial<ItemDrop> = {}): ItemDrop {
  return {
    id: 1,
    blockId: 2,
    count: 1,
    x: 0.5,
    y: 5,
    vx: 0,
    vy: 0,
    age: 0,
    pickupDelay: PICKUP_DELAY,
    ...overrides,
  };
}

describe('item drops', () => {
  it('falls under gravity and lands on solid ground', () => {
    let d = drop();
    for (let i = 0; i < 300; i++) d = stepDrop(d, 1 / 60, isSolid);

    expect(d.y).toBeCloseTo(FLOOR_Y, 5); // feet rest on top of the floor row
    expect(d.vy).toBe(0);
  });

  it('slides to a stop with ground friction', () => {
    let d = drop({ y: FLOOR_Y, vx: 4 });
    for (let i = 0; i < 120; i++) d = stepDrop(d, 1 / 60, isSolid);

    expect(d.vx).toBe(0);
    expect(d.x).toBeGreaterThan(0.5);
  });

  it('despawns after DESPAWN_SECONDS', () => {
    const manager = new ItemDropManager();
    manager.spawn({ blockId: 2, count: 1 }, 0.5, FLOOR_Y);
    manager.load(manager.drops.map((d) => ({ ...d, age: DESPAWN_SECONDS - 0.05 })));

    manager.step(0.1, isSolid);

    expect(manager.drops).toHaveLength(0);
  });

  it('is picked up near the player once the pickup delay passed', () => {
    const manager = new ItemDropManager();
    manager.spawn({ blockId: 2, count: 3 }, 0.5, FLOOR_Y, { vx: 0, vy: 0 });

    // Too fresh: nothing happens.
    expect(manager.collect(0.5, FLOOR_Y, () => 0)).toEqual([]);
    expect(manager.drops).toHaveLength(1);

    for (let i = 0; i < 60; i++) manager.step(1 / 60, isSolid);
    const collected = manager.collect(0.5, FLOOR_Y, () => 0);

    expect(collected).toEqual([{ blockId: 2, count: 3 }]);
    expect(manager.drops).toHaveLength(0);
  });

  it('keeps the leftover on the ground when the inventory is nearly full', () => {
    const manager = new ItemDropManager();
    manager.spawn({ blockId: 2, count: 10 }, 0.5, FLOOR_Y, { vx: 0, vy: 0 });
    for (let i = 0; i < 60; i++) manager.step(1 / 60, isSolid);

    const collected = manager.collect(0.5, FLOOR_Y, () => 4); // only 6 fit

    expect(collected).toEqual([{ blockId: 2, count: 6 }]);
    expect(manager.drops).toHaveLength(1);
    expect(manager.drops[0]?.count).toBe(4);
  });

  it('ignores drops out of pickup range', () => {
    const manager = new ItemDropManager();
    manager.spawn({ blockId: 2, count: 1 }, 8.5, FLOOR_Y, { vx: 0, vy: 0 });
    for (let i = 0; i < 60; i++) manager.step(1 / 60, isSolid);

    expect(manager.collect(0.5, FLOOR_Y, () => 0)).toEqual([]);
    expect(manager.drops).toHaveLength(1);
  });
});
