import { describe, expect, it } from 'vitest';
import { createBlockRegistry } from '@/blocks/registry';
import {
  consumeCraftingIngredients,
  craftingResult,
  createDefaultRecipes,
  findCraftingRecipe,
  type CraftingRecipe,
} from './crafting';
import { ItemGrid } from './item-grid';

const LOG_TO_PLANKS: CraftingRecipe = {
  ingredients: [7],
  result: { blockId: 8, count: 4 },
};

const PLANKS_TO_TABLE: CraftingRecipe = {
  ingredients: [8, 8, 8, 8],
  result: { blockId: 14, count: 1 },
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

  it('is grid-size agnostic: the same recipes work on a 3x3 grid', () => {
    const grid: Array<{ blockId: number; count: number } | null> = Array.from(
      { length: 9 },
      () => null,
    );
    grid[4] = { blockId: 7, count: 1 };
    expect(craftingResult(grid, [LOG_TO_PLANKS])).toEqual({ blockId: 8, count: 4 });
  });

  it('never matches recipes with more ingredients than grid slots', () => {
    const grid = [
      { blockId: 8, count: 1 },
      { blockId: 8, count: 1 },
      { blockId: 8, count: 1 },
      { blockId: 8, count: 1 },
    ];
    // 4 planks fit a 2x2 grid...
    expect(craftingResult(grid, [PLANKS_TO_TABLE])).toEqual({ blockId: 14, count: 1 });
    // ...but an 8-ingredient recipe (furnace/chest) can never match 4 slots.
    const eight: CraftingRecipe = {
      ingredients: Array.from({ length: 8 }, () => 4),
      result: { blockId: 15, count: 1 },
    };
    expect(craftingResult(grid, [eight])).toBeNull();
  });

  it('finds and consumes one item from each matched ingredient slot', () => {
    const grid = new ItemGrid(4);
    grid.setSlot(2, { blockId: 7, count: 2 });

    const recipe = findCraftingRecipe(grid.snapshot(), [LOG_TO_PLANKS]);
    expect(recipe).toBe(LOG_TO_PLANKS);

    consumeCraftingIngredients(grid, LOG_TO_PLANKS);
    expect(grid.slot(2)).toEqual({ blockId: 7, count: 1 });
  });

  it('ships default recipes for the survival progression', () => {
    const registry = createBlockRegistry();
    const recipes = createDefaultRecipes(registry);

    const planks = registry.idOf('oak_planks');
    const results = recipes.map((r) => r.result.blockId);
    expect(results).toContain(planks);
    expect(results).toContain(registry.idOf('stick'));
    expect(results).toContain(registry.idOf('crafting_table'));
    expect(results).toContain(registry.idOf('furnace'));
    expect(results).toContain(registry.idOf('chest'));

    // The furnace needs 8 cobblestone, so it is 3x3-table-only by ingredient count.
    const furnace = recipes.find((r) => r.result.blockId === registry.idOf('furnace'));
    expect(furnace?.ingredients).toHaveLength(8);
  });
});
