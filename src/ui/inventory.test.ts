import { describe, expect, it } from 'vitest';
import {
  CRAFTING_GRID_SIZE,
  HOTBAR_SIZE,
  Inventory,
  MAX_STACK_SIZE,
  PLAYER_INVENTORY_SIZE,
} from './inventory';

describe('Inventory', () => {
  it('starts with empty player inventory and crafting slots', () => {
    const inventory = new Inventory();

    expect(inventory.size).toBe(PLAYER_INVENTORY_SIZE);
    expect(inventory.hotbarSize).toBe(HOTBAR_SIZE);
    expect(inventory.selectedIndex).toBe(0);
    expect(inventory.snapshot()).toEqual(Array.from({ length: PLAYER_INVENTORY_SIZE }, () => null));
    expect(inventory.craftingSnapshot()).toEqual(
      Array.from({ length: CRAFTING_GRID_SIZE }, () => null),
    );
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

  it('sets inventory and crafting slots defensively', () => {
    const inventory = new Inventory();
    const stack = { blockId: 3, count: 2 };

    inventory.setSlot(12, stack);
    inventory.setCraftingSlot(1, stack);
    stack.count = 99;

    expect(inventory.slot(12)).toEqual({ blockId: 3, count: 2 });
    expect(inventory.craftingSlot(1)).toEqual({ blockId: 3, count: 2 });
  });

  it('consumes crafting ingredients one item at a time', () => {
    const inventory = new Inventory();
    inventory.setCraftingSlot(0, { blockId: 4, count: 2 });

    expect(inventory.consumeCraftingSlot(0)).toBe(4);
    expect(inventory.craftingSlot(0)).toEqual({ blockId: 4, count: 1 });

    expect(inventory.consumeCraftingSlot(0)).toBe(4);
    expect(inventory.craftingSlot(0)).toBeNull();
  });

  it('rejects invalid slots, items, counts, and cycle deltas', () => {
    const inventory = new Inventory();

    expect(() => new Inventory(0)).toThrow(RangeError);
    expect(() => new Inventory(1, 0)).toThrow(RangeError);
    expect(() => inventory.select(HOTBAR_SIZE)).toThrow(RangeError);
    expect(() => inventory.setSlot(PLAYER_INVENTORY_SIZE, null)).toThrow(RangeError);
    expect(() => inventory.setCraftingSlot(CRAFTING_GRID_SIZE, null)).toThrow(RangeError);
    expect(() => inventory.add(0)).toThrow(RangeError);
    expect(() => inventory.add(1, 0)).toThrow(RangeError);
    expect(() => inventory.setSlot(0, { blockId: 1, count: MAX_STACK_SIZE + 1 })).toThrow(
      RangeError,
    );
    expect(() => inventory.cycleSelected(0.5)).toThrow(RangeError);
  });
});
