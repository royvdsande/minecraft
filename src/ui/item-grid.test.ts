import { describe, expect, it } from 'vitest';
import { ItemGrid } from './item-grid';

describe('ItemGrid', () => {
  it('starts empty and reports emptiness', () => {
    const grid = new ItemGrid(4);
    expect(grid.size).toBe(4);
    expect(grid.isEmpty).toBe(true);
    expect(grid.snapshot()).toEqual([null, null, null, null]);
  });

  it('stores defensive copies', () => {
    const grid = new ItemGrid(4);
    const stack = { blockId: 3, count: 2 };
    grid.setSlot(1, stack);
    stack.count = 99;
    expect(grid.slot(1)).toEqual({ blockId: 3, count: 2 });
  });

  it('consumes items one at a time and clears empty stacks', () => {
    const grid = new ItemGrid(4);
    grid.setSlot(0, { blockId: 4, count: 2 });

    expect(grid.consumeSlot(0)).toBe(4);
    expect(grid.slot(0)).toEqual({ blockId: 4, count: 1 });
    expect(grid.consumeSlot(0)).toBe(4);
    expect(grid.slot(0)).toBeNull();
    expect(grid.consumeSlot(0)).toBeNull();
  });

  it('drains all contents at once (close-screen behaviour)', () => {
    const grid = new ItemGrid(4);
    grid.setSlot(0, { blockId: 4, count: 2 });
    grid.setSlot(3, { blockId: 7, count: 1 });

    expect(grid.drain()).toEqual([
      { blockId: 4, count: 2 },
      { blockId: 7, count: 1 },
    ]);
    expect(grid.isEmpty).toBe(true);
  });

  it('rejects invalid sizes, indices and stacks', () => {
    expect(() => new ItemGrid(0)).toThrow(RangeError);
    const grid = new ItemGrid(2);
    expect(() => grid.slot(2)).toThrow(RangeError);
    expect(() => grid.setSlot(0, { blockId: 0, count: 1 })).toThrow(RangeError);
    expect(() => grid.setSlot(0, { blockId: 1, count: 0 })).toThrow(RangeError);
    expect(() => grid.setSlot(0, { blockId: 1, count: 65 })).toThrow(RangeError);
  });
});
