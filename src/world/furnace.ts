import type { BlockId } from '@/blocks/block';
import type { BlockRegistry } from '@/blocks/registry';
import { MAX_STACK_SIZE } from '@/ui/inventory';
import type { FurnaceEntity } from './block-entities';

/** Seconds to smelt one item (Minecraft's classic 10s). */
export const SMELT_SECONDS = 10;

/** Data-driven smelting: input block id -> output block id. */
export type SmeltingRecipes = ReadonlyMap<BlockId, BlockId>;

export function createSmeltingRecipes(registry: BlockRegistry): SmeltingRecipes {
  const id = (key: string): BlockId => registry.idOf(key);
  return new Map<BlockId, BlockId>([
    [id('iron_ore'), id('iron_ingot')],
    [id('gold_ore'), id('gold_ingot')],
    [id('sand'), id('glass')],
    [id('cobblestone'), id('stone')],
    [id('oak_log'), id('charcoal')],
  ]);
}

export interface FurnaceContext {
  readonly recipes: SmeltingRecipes;
  /** Burn seconds for a fuel block id, or null when it cannot burn. */
  fuelSecondsOf(blockId: BlockId): number | null;
}

/**
 * Advance a furnace by `dt` seconds (mutates the entity). Fuel is consumed one
 * item at a time and keeps burning even without input, like Minecraft.
 * Returns true when anything changed (for save-dirtiness).
 */
export function stepFurnace(furnace: FurnaceEntity, dt: number, ctx: FurnaceContext): boolean {
  const before = furnace.burnRemaining > 0 || furnace.cookProgress > 0;
  const output = smeltOutputFor(furnace, ctx);

  // Ignite the next fuel item when there is something to smelt.
  if (furnace.burnRemaining <= 0 && output !== null && furnace.fuel) {
    const seconds = ctx.fuelSecondsOf(furnace.fuel.blockId);
    if (seconds !== null) {
      furnace.fuel =
        furnace.fuel.count > 1
          ? { blockId: furnace.fuel.blockId, count: furnace.fuel.count - 1 }
          : null;
      furnace.burnRemaining = seconds;
      furnace.burnTotal = seconds;
    }
  }

  if (furnace.burnRemaining > 0) {
    furnace.burnRemaining = Math.max(0, furnace.burnRemaining - dt);
    if (output !== null) {
      furnace.cookProgress += dt;
      if (furnace.cookProgress >= SMELT_SECONDS && furnace.input) {
        furnace.input =
          furnace.input.count > 1
            ? { blockId: furnace.input.blockId, count: furnace.input.count - 1 }
            : null;
        furnace.output = furnace.output
          ? { blockId: furnace.output.blockId, count: furnace.output.count + 1 }
          : { blockId: output, count: 1 };
        furnace.cookProgress = 0;
      }
    } else {
      furnace.cookProgress = 0;
    }
  } else {
    furnace.cookProgress = 0;
  }

  return before || furnace.burnRemaining > 0 || furnace.cookProgress > 0;
}

/** Output id if the current input can smelt into the output slot, else null. */
export function smeltOutputFor(furnace: FurnaceEntity, ctx: FurnaceContext): BlockId | null {
  if (!furnace.input) return null;
  const output = ctx.recipes.get(furnace.input.blockId);
  if (output === undefined) return null;
  if (furnace.output === null) return output;
  if (furnace.output.blockId !== output) return null;
  return furnace.output.count < MAX_STACK_SIZE ? output : null;
}

/** Convenience for UIs: 0..1 gauges. */
export function furnaceGauges(furnace: FurnaceEntity): { burn: number; cook: number } {
  return {
    burn: furnace.burnTotal > 0 ? furnace.burnRemaining / furnace.burnTotal : 0,
    cook: furnace.cookProgress / SMELT_SECONDS,
  };
}
