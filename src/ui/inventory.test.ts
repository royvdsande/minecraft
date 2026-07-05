import { describe, expect, it } from 'vitest';
import { HOTBAR_SIZE, Inventory, MAX_STACK_SIZE } from './inventory';

describe('Inventory', () => {
  it('starts with empty hotbar slots and selected slot 0', () => {
    const inventory = new Inventory();

    expect(inventory.size).toBe(HOTBAR_SIZE);
    expect(inventory.selectedIndex).toBe(0);
    expect(inventory.snapshot()).toEqual(Array.from({ length: HOTBAR_SIZE }, () => null));
  });

  it('selects and cycles slots with wrapping', () => {
    const inventory = new Inventory(3);

    inventory.select(2);
    expect(inventory.selectedIndex).toBe(2);

    inventory.cycleSelected(1);
    expect(inventory.selectedIndex).toBe(0);

    inventory.cycleSelected(-1);
    expect(inventory.selectedIndex).toBe(2);
  });

  it('adds items to existing stacks before using empty slots', () => {
    const inventory = new Inventory(3);

    expect(inventory.add(2, 10)).toBe(0);
    expect(inventory.add(3, 5)).toBe(0);
    expect(inventory.add(2, 7)).toBe(0);

    expect(inventory.snapshot()).toEqual([
      { blockId: 2, count: 17 },
      { blockId: 3, count: 5 },
      null,
    ]);
  });

  it('splits oversized additions across stacks', () => {
    const inventory = new Inventory(3);

    expect(inventory.add(4, MAX_STACK_SIZE + 3)).toBe(0);

    expect(inventory.snapshot()).toEqual([
      { blockId: 4, count: MAX_STACK_SIZE },
      { blockId: 4, count: 3 },
      null,
    ]);
  });

  it('reports leftover items when full', () => {
    const inventory = new Inventory(2, 4);

    expect(inventory.add(7, 8)).toBe(0);
    expect(inventory.canAdd(7)).toBe(false);
    expect(inventory.add(7, 2)).toBe(2);
  });

  it('consumes from the selected slot and clears empty stacks', () => {
    const inventory = new Inventory(2);
    inventory.add(5, 2);

    expect(inventory.consumeSelected()).toBe(5);
    expect(inventory.selectedSlot).toEqual({ blockId: 5, count: 1 });

    expect(inventory.consumeSelected()).toBe(5);
    expect(inventory.selectedSlot).toBeNull();
    expect(inventory.consumeSelected()).toBeNull();
  });

  it('rejects invalid slots, items, counts, and cycle deltas', () => {
    const inventory = new Inventory();

    expect(() => new Inventory(0)).toThrow(RangeError);
    expect(() => new Inventory(1, 0)).toThrow(RangeError);
    expect(() => inventory.select(HOTBAR_SIZE)).toThrow(RangeError);
    expect(() => inventory.add(0)).toThrow(RangeError);
    expect(() => inventory.add(1, 0)).toThrow(RangeError);
    expect(() => inventory.cycleSelected(0.5)).toThrow(RangeError);
  });
});
