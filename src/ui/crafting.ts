import type { BlockId, ItemStack } from '@/blocks/block';
import type { BlockRegistry } from '@/blocks/registry';
import type { ItemGrid } from './item-grid';

/**
 * Shapeless crafting: a recipe is a multiset of ingredient block ids (one item
 * per occupied grid slot) plus a result stack. Grid-size agnostic, so the same
 * matcher serves the 2x2 player grid and the 3x3 crafting table — recipes with
 * more ingredients than slots simply never match.
 */
export interface CraftingRecipe {
  readonly ingredients: readonly BlockId[];
  readonly result: ItemStack;
}

export function craftingResult(
  grid: ReadonlyArray<ItemStack | null>,
  recipes: readonly CraftingRecipe[],
): ItemStack | null {
  return findCraftingRecipe(grid, recipes)?.result ?? null;
}

export function findCraftingRecipe(
  grid: ReadonlyArray<ItemStack | null>,
  recipes: readonly CraftingRecipe[],
): CraftingRecipe | null {
  for (const recipe of recipes) {
    if (matchesRecipe(grid, recipe)) return recipe;
  }
  return null;
}

/** Take one item out of every occupied slot the recipe consumed. */
export function consumeCraftingIngredients(grid: ItemGrid, recipe: CraftingRecipe): void {
  const needed = countIngredients(recipe.ingredients);
  for (let i = 0; i < grid.size; i++) {
    const slot = grid.slot(i);
    if (!slot) continue;
    const remaining = needed.get(slot.blockId) ?? 0;
    if (remaining <= 0) continue;
    grid.consumeSlot(i);
    if (remaining === 1) needed.delete(slot.blockId);
    else needed.set(slot.blockId, remaining - 1);
  }
}

/** The default recipe set. Data only — extend by appending. */
export function createDefaultRecipes(registry: BlockRegistry): CraftingRecipe[] {
  const id = (key: string): BlockId => registry.idOf(key);
  const times = (key: string, count: number): BlockId[] =>
    Array.from({ length: count }, () => id(key));

  return [
    { ingredients: [id('oak_log')], result: { blockId: id('oak_planks'), count: 4 } },
    { ingredients: times('oak_planks', 2), result: { blockId: id('stick'), count: 4 } },
    { ingredients: times('oak_planks', 4), result: { blockId: id('crafting_table'), count: 1 } },
    // 3x3-only recipes (more than 4 ingredients never fit the 2x2 grid).
    { ingredients: times('cobblestone', 8), result: { blockId: id('furnace'), count: 1 } },
    { ingredients: times('oak_planks', 8), result: { blockId: id('chest'), count: 1 } },
  ];
}

function matchesRecipe(grid: ReadonlyArray<ItemStack | null>, recipe: CraftingRecipe): boolean {
  if (recipe.ingredients.length === 0 || recipe.ingredients.length > grid.length) {
    return false;
  }

  const occupied = grid.filter((slot): slot is ItemStack => slot !== null);
  if (occupied.length !== recipe.ingredients.length) return false;

  const actual = countIngredients(occupied.map((slot) => slot.blockId));
  const expected = countIngredients(recipe.ingredients);
  if (actual.size !== expected.size) return false;

  for (const [blockId, count] of expected) {
    if (actual.get(blockId) !== count) return false;
  }
  return true;
}

function countIngredients(items: readonly BlockId[]): Map<BlockId, number> {
  const counts = new Map<BlockId, number>();
  for (const blockId of items) counts.set(blockId, (counts.get(blockId) ?? 0) + 1);
  return counts;
}
