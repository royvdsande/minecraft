import type { ItemStack } from '@/blocks/block';
import { MAX_STACK_SIZE } from './inventory';

/**
 * A plain grid of item stacks: the transient crafting grids (2x2 player /
 * 3x3 crafting table) and chest storage. Pure logic, no Pixi/DOM.
 */
export class ItemGrid {
  private readonly slots: Array<ItemStack | null>;

  constructor(
    size: number,
    private readonly maxStackSize: number = MAX_STACK_SIZE,
  ) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError(`Item grid size must be a positive integer: ${size}`);
    }
    this.slots = Array.from({ length: size }, () => null);
  }

  get size(): number {
    return this.slots.length;
  }

  get isEmpty(): boolean {
    return this.slots.every((slot) => slot === null);
  }

  slot(index: number): ItemStack | null {
    this.assertIndex(index);
    const slot = this.slots[index] ?? null;
    return slot ? { ...slot } : null;
  }

  setSlot(index: number, slot: ItemStack | null): void {
    this.assertIndex(index);
    if (slot !== null) {
      if (!Number.isInteger(slot.blockId) || slot.blockId <= 0) {
        throw new RangeError(`Grid item must be a non-air block id: ${slot.blockId}`);
      }
      if (!Number.isInteger(slot.count) || slot.count <= 0 || slot.count > this.maxStackSize) {
        throw new RangeError(`Grid stack count out of range: ${slot.count}`);
      }
    }
    this.slots[index] = slot ? { ...slot } : null;
  }

  /** Remove `count` items from a slot; returns the removed block id or null. */
  consumeSlot(index: number, count: number = 1): number | null {
    const slot = this.slot(index);
    if (!slot || slot.count < count) return null;
    const remaining = slot.count - count;
    this.slots[index] = remaining > 0 ? { blockId: slot.blockId, count: remaining } : null;
    return slot.blockId;
  }

  snapshot(): ReadonlyArray<ItemStack | null> {
    return this.slots.map((slot) => (slot ? { ...slot } : null));
  }

  /** Empty the grid, returning every stack that was in it. */
  drain(): ItemStack[] {
    const stacks: ItemStack[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot) stacks.push(slot);
      this.slots[i] = null;
    }
    return stacks;
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.slots.length) {
      throw new RangeError(`Item grid slot out of range: ${index}`);
    }
  }
}
