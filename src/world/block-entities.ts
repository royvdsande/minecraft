import type { BlockInteraction, ItemStack } from '@/blocks/block';

/**
 * Per-position state for functional blocks (chests, furnaces). Pure data — the
 * UI and the furnace tick read/write it; saves serialize it (save v2).
 */

export const CHEST_SIZE = 27;

export interface ChestEntity {
  readonly kind: 'chest';
  /** Mutable storage; length CHEST_SIZE. */
  readonly slots: Array<ItemStack | null>;
}

export interface FurnaceEntity {
  readonly kind: 'furnace';
  input: ItemStack | null;
  fuel: ItemStack | null;
  output: ItemStack | null;
  /** Seconds of burn left on the currently burning fuel item. */
  burnRemaining: number;
  /** Total burn seconds of that fuel item (for the flame gauge). */
  burnTotal: number;
  /** Seconds the current input item has been smelting. */
  cookProgress: number;
}

export type BlockEntity = ChestEntity | FurnaceEntity;

export function createChestEntity(): ChestEntity {
  return { kind: 'chest', slots: Array.from({ length: CHEST_SIZE }, () => null) };
}

export function createFurnaceEntity(): FurnaceEntity {
  return {
    kind: 'furnace',
    input: null,
    fuel: null,
    output: null,
    burnRemaining: 0,
    burnTotal: 0,
    cookProgress: 0,
  };
}

/** The block entity a freshly placed block of this interaction needs, if any. */
export function createBlockEntity(interaction: BlockInteraction): BlockEntity | null {
  if (interaction === 'chest') return createChestEntity();
  if (interaction === 'furnace') return createFurnaceEntity();
  return null; // crafting tables are stateless
}

/** Every stack currently stored inside an entity (for drop-on-break). */
export function blockEntityContents(entity: BlockEntity): ItemStack[] {
  if (entity.kind === 'chest') {
    return entity.slots.filter((slot): slot is ItemStack => slot !== null);
  }
  return [entity.input, entity.fuel, entity.output].filter(
    (slot): slot is ItemStack => slot !== null,
  );
}

export class BlockEntityStore {
  private readonly entities = new Map<string, BlockEntity>();

  get(bx: number, by: number): BlockEntity | null {
    return this.entities.get(key(bx, by)) ?? null;
  }

  set(bx: number, by: number, entity: BlockEntity): void {
    this.entities.set(key(bx, by), entity);
  }

  remove(bx: number, by: number): void {
    this.entities.delete(key(bx, by));
  }

  entries(): Array<{ bx: number; by: number; entity: BlockEntity }> {
    return [...this.entities.entries()].map(([k, entity]) => {
      const [bx = 0, by = 0] = k.split(',').map(Number);
      return { bx, by, entity };
    });
  }
}

function key(bx: number, by: number): string {
  return `${bx},${by}`;
}
