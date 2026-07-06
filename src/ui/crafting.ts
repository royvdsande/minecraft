import type { BlockId } from '@/blocks/block';
import type { Inventory, InventorySlot } from './inventory';
import { CRAFTING_GRID_SIZE } from './inventory';

export interface CraftingRecipe {
  readonly ingredients: readonly BlockId[];
  readonly result: InventorySlot;
}

export function craftingResult(
  grid: ReadonlyArray<InventorySlot | null>,
  recipes: readonly CraftingRecipe[],
): InventorySlot | null {
  return findCraftingRecipe(grid, recipes)?.result ?? null;
}

export function findCraftingRecipe(
  grid: ReadonlyArray<InventorySlot | null>,
  recipes: readonly CraftingRecipe[],
): CraftingRecipe | null {
  assertCraftingGrid(grid);
  for (const recipe of recipes) {
    if (matchesRecipe(grid, recipe)) return recipe;
  }
  return null;
}

export function consumeCraftingIngredients(inventory: Inventory, recipe: CraftingRecipe): void {
  const needed = countIngredients(recipe.ingredients);
  for (let i = 0; i < CRAFTING_GRID_SIZE; i++) {
    const slot = inventory.craftingSlot(i);
    if (!slot) continue;
    const remaining = needed.get(slot.blockId) ?? 0;
    if (remaining <= 0) continue;
    inventory.consumeCraftingSlot(i);
    if (remaining === 1) needed.delete(slot.blockId);
    else needed.set(slot.blockId, remaining - 1);
  }
}

function matchesRecipe(grid: ReadonlyArray<InventorySlot | null>, recipe: CraftingRecipe): boolean {
  if (recipe.ingredients.length === 0 || recipe.ingredients.length > CRAFTING_GRID_SIZE) {
    return false;
  }

  const occupied = grid.filter((slot) => slot !== null);
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

function assertCraftingGrid(grid: ReadonlyArray<InventorySlot | null>): void {
  if (grid.length !== CRAFTING_GRID_SIZE) {
    throw new RangeError(`Crafting grid must have ${CRAFTING_GRID_SIZE} slots`);
  }
}
