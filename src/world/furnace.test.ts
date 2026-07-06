import { describe, expect, it } from 'vitest';
import { createBlockRegistry } from '@/blocks/registry';
import { createFurnaceEntity } from './block-entities';
import {
  SMELT_SECONDS,
  createSmeltingRecipes,
  furnaceGauges,
  smeltOutputFor,
  stepFurnace,
  type FurnaceContext,
} from './furnace';

function context(): FurnaceContext {
  const registry = createBlockRegistry();
  return {
    recipes: createSmeltingRecipes(registry),
    fuelSecondsOf: (blockId) => registry.byId(blockId).fuelSeconds ?? null,
  };
}

function ids(): { ironOre: number; ironIngot: number; coal: number; stone: number } {
  const registry = createBlockRegistry();
  return {
    ironOre: registry.idOf('iron_ore'),
    ironIngot: registry.idOf('iron_ingot'),
    coal: registry.idOf('coal'),
    stone: registry.idOf('stone'),
  };
}

describe('furnace', () => {
  it('smelts one input per SMELT_SECONDS while fuel burns', () => {
    const ctx = context();
    const { ironOre, ironIngot, coal } = ids();
    const furnace = createFurnaceEntity();
    furnace.input = { blockId: ironOre, count: 2 };
    furnace.fuel = { blockId: coal, count: 1 };

    stepFurnace(furnace, SMELT_SECONDS, ctx);

    expect(furnace.output).toEqual({ blockId: ironIngot, count: 1 });
    expect(furnace.input).toEqual({ blockId: ironOre, count: 1 });
    expect(furnace.fuel).toBeNull(); // the coal item was consumed on ignite
    expect(furnace.burnRemaining).toBeGreaterThan(0); // coal burns 80s
  });

  it('does nothing without fuel', () => {
    const ctx = context();
    const { ironOre } = ids();
    const furnace = createFurnaceEntity();
    furnace.input = { blockId: ironOre, count: 1 };

    stepFurnace(furnace, 30, ctx);

    expect(furnace.output).toBeNull();
    expect(furnace.input).toEqual({ blockId: ironOre, count: 1 });
    expect(furnace.cookProgress).toBe(0);
  });

  it('does not ignite fuel when there is nothing to smelt', () => {
    const ctx = context();
    const { coal, stone } = ids();
    const furnace = createFurnaceEntity();
    furnace.fuel = { blockId: coal, count: 5 };
    furnace.input = { blockId: stone, count: 1 }; // stone is not smeltable

    stepFurnace(furnace, 30, ctx);

    expect(furnace.fuel).toEqual({ blockId: coal, count: 5 });
    expect(furnace.burnRemaining).toBe(0);
  });

  it('resets cook progress when the input is removed mid-smelt', () => {
    const ctx = context();
    const { ironOre, coal } = ids();
    const furnace = createFurnaceEntity();
    furnace.input = { blockId: ironOre, count: 1 };
    furnace.fuel = { blockId: coal, count: 1 };

    stepFurnace(furnace, SMELT_SECONDS / 2, ctx);
    expect(furnace.cookProgress).toBeGreaterThan(0);

    furnace.input = null;
    stepFurnace(furnace, 0.1, ctx);
    expect(furnace.cookProgress).toBe(0);
  });

  it('blocks smelting into a mismatched or full output', () => {
    const ctx = context();
    const { ironOre, stone } = ids();
    const furnace = createFurnaceEntity();
    furnace.input = { blockId: ironOre, count: 1 };
    furnace.output = { blockId: stone, count: 1 };

    expect(smeltOutputFor(furnace, ctx)).toBeNull();
  });

  it('exposes 0..1 gauges for the UI', () => {
    const furnace = createFurnaceEntity();
    furnace.burnTotal = 10;
    furnace.burnRemaining = 5;
    furnace.cookProgress = SMELT_SECONDS / 4;

    expect(furnaceGauges(furnace)).toEqual({ burn: 0.5, cook: 0.25 });
  });
});
