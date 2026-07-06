import { describe, expect, it } from 'vitest';
import {
  consumeCraftingIngredients,
  craftingResult,
  findCraftingRecipe,
  type CraftingRecipe,
} from './crafting';
import { Inventory } from './inventory';

const LOG_TO_PLANKS: CraftingRecipe = {
  ingredients: [7],
  result: { blockId: 8, count: 4 },
};

describe('crafting', () => {
  it('matches shapeless 2x2 recipes regardless of occupied cell', () => {
    expect(craftingResult([{ blockId: 7, count: 3 }, null, null, null], [LOG_TO_PLANKS])).toEqual({
      blockId: 8,
      count: 4,
    });
    expect(craftingResult([null, null, null, { blockId: 7, count: 1 }], [LOG_TO_PLANKS])).toEqual({
      blockId: 8,
      count: 4,
    });
  });

  it('does not match when extra ingredients are present', () => {
    expect(
      craftingResult(
        [{ blockId: 7, count: 1 }, { blockId: 2, count: 1 }, null, null],
        [LOG_TO_PLANKS],
      ),
    ).toBeNull();
  });

  it('finds and consumes one item from each matched ingredient slot', () => {
    const inventory = new Inventory();
    inventory.setCraftingSlot(2, { blockId: 7, count: 2 });

    const recipe = findCraftingRecipe(inventory.craftingSnapshot(), [LOG_TO_PLANKS]);
    expect(recipe).toBe(LOG_TO_PLANKS);

    consumeCraftingIngredients(inventory, LOG_TO_PLANKS);
    expect(inventory.craftingSlot(2)).toEqual({ blockId: 7, count: 1 });
  });

  it('rejects grids that are not 2x2', () => {
    expect(() => craftingResult([null], [LOG_TO_PLANKS])).toThrow(RangeError);
  });
});
