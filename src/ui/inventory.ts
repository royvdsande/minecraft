import type { BlockId } from '@/blocks/block';

export const HOTBAR_SIZE = 9;
export const INVENTORY_COLUMNS = 9;
export const MAIN_INVENTORY_ROWS = 3;
export const MAIN_INVENTORY_SIZE = INVENTORY_COLUMNS * MAIN_INVENTORY_ROWS;
export const PLAYER_INVENTORY_SIZE = HOTBAR_SIZE + MAIN_INVENTORY_SIZE;
export const CRAFTING_GRID_SIZE = 4;
export const MAX_STACK_SIZE = 64;

export interface InventorySlot {
  readonly blockId: BlockId;
  readonly count: number;
}

/**
 * Pure player inventory: 9 hotbar slots, 27 storage slots, stackable block
 * items, selected hotbar slot, and a separate 2x2 crafting grid. No Pixi/DOM
 * dependencies so gameplay rules stay unit-testable.
 */
export class Inventory {
  private readonly slots: Array<InventorySlot | null>;
  private readonly craftingSlots: Array<InventorySlot | null>;
  private selected = 0;

  constructor(
    size: number = PLAYER_INVENTORY_SIZE,
    private readonly maxStackSize: number = MAX_STACK_SIZE,
    private readonly hotbarSlotCount: number = Math.min(HOTBAR_SIZE, size),
  ) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError(`Inventory size must be a positive integer: ${size}`);
    }
    if (!Number.isInteger(maxStackSize) || maxStackSize <= 0) {
      throw new RangeError(`Max stack size must be a positive integer: ${maxStackSize}`);
    }
    if (!Number.isInteger(hotbarSlotCount) || hotbarSlotCount <= 0 || hotbarSlotCount > size) {
      throw new RangeError(`Hotbar size must be between 1 and inventory size: ${hotbarSlotCount}`);
    }
    this.slots = Array.from({ length: size }, () => null);
    this.craftingSlots = Array.from({ length: CRAFTING_GRID_SIZE }, () => null);
  }

  get size(): number {
    return this.slots.length;
  }

  get hotbarSize(): number {
    return this.hotbarSlotCount;
  }

  get selectedIndex(): number {
    return this.selected;
  }

  get selectedSlot(): InventorySlot | null {
    return this.slot(this.selected);
  }

  slot(index: number): InventorySlot | null {
    this.assertIndex(index);
    const slot = this.slots[index] ?? null;
    return slot ? { ...slot } : null;
  }

  snapshot(): ReadonlyArray<InventorySlot | null> {
    return this.slots.map((slot) => (slot ? { ...slot } : null));
  }

  craftingSnapshot(): ReadonlyArray<InventorySlot | null> {
    return this.craftingSlots.map((slot) => (slot ? { ...slot } : null));
  }

  select(index: number): void {
    this.assertHotbarIndex(index);
    this.selected = index;
  }

  cycleSelected(delta: number): void {
    if (!Number.isInteger(delta)) {
      throw new RangeError(`Selection delta must be an integer: ${delta}`);
    }
    this.selected = wrapIndex(this.selected + delta, this.hotbarSlotCount);
  }

  setSlot(index: number, slot: InventorySlot | null): void {
    this.assertIndex(index);
    this.slots[index] = this.copyValidatedSlot(slot);
  }

  setCraftingSlot(index: number, slot: InventorySlot | null): void {
    this.assertCraftingIndex(index);
    this.craftingSlots[index] = this.copyValidatedSlot(slot);
  }

  canAdd(blockId: BlockId, count: number = 1): boolean {
    this.assertItem(blockId, count);
    return this.capacityFor(blockId) >= count;
  }

  /** Add as much as fits. Returns the leftover count that did not fit. */
  add(blockId: BlockId, count: number = 1): number {
    this.assertItem(blockId, count);
    let remaining = count;

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const slot = this.slots[i];
      if (!slot || slot.blockId !== blockId || slot.count >= this.maxStackSize) continue;
      const moved = Math.min(remaining, this.maxStackSize - slot.count);
      this.slots[i] = { blockId, count: slot.count + moved };
      remaining -= moved;
    }

    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i]) continue;
      const moved = Math.min(remaining, this.maxStackSize);
      this.slots[i] = { blockId, count: moved };
      remaining -= moved;
    }

    return remaining;
  }

  /** Consume items from the selected slot. Returns the consumed block id. */
  consumeSelected(count: number = 1): BlockId | null {
    this.assertCount(count);
    const slot = this.slots[this.selected];
    if (!slot || slot.count < count) return null;

    const remaining = slot.count - count;
    this.slots[this.selected] = remaining > 0 ? { blockId: slot.blockId, count: remaining } : null;
    return slot.blockId;
  }

  craftingSlot(index: number): InventorySlot | null {
    this.assertCraftingIndex(index);
    const slot = this.craftingSlots[index] ?? null;
    return slot ? { ...slot } : null;
  }

  consumeCraftingSlot(index: number, count: number = 1): BlockId | null {
    this.assertCraftingIndex(index);
    this.assertCount(count);
    const slot = this.craftingSlots[index];
    if (!slot || slot.count < count) return null;

    const remaining = slot.count - count;
    this.craftingSlots[index] = remaining > 0 ? { blockId: slot.blockId, count: remaining } : null;
    return slot.blockId;
  }

  private capacityFor(blockId: BlockId): number {
    let capacity = 0;
    for (const slot of this.slots) {
      if (!slot) {
        capacity += this.maxStackSize;
      } else if (slot.blockId === blockId) {
        capacity += this.maxStackSize - slot.count;
      }
    }
    return capacity;
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.slots.length) {
      throw new RangeError(`Inventory slot out of range: ${index}`);
    }
  }

  private assertHotbarIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.hotbarSlotCount) {
      throw new RangeError(`Hotbar slot out of range: ${index}`);
    }
  }

  private assertCraftingIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.craftingSlots.length) {
      throw new RangeError(`Crafting slot out of range: ${index}`);
    }
  }

  private copyValidatedSlot(slot: InventorySlot | null): InventorySlot | null {
    if (slot === null) return null;
    this.assertItem(slot.blockId, slot.count);
    if (slot.count > this.maxStackSize) {
      throw new RangeError(`Inventory stack exceeds max size: ${slot.count}`);
    }
    return { ...slot };
  }

  private assertItem(blockId: BlockId, count: number): void {
    if (!Number.isInteger(blockId) || blockId <= 0) {
      throw new RangeError(`Inventory item must be a non-air block id: ${blockId}`);
    }
    this.assertCount(count);
  }

  private assertCount(count: number): void {
    if (!Number.isInteger(count) || count <= 0) {
      throw new RangeError(`Inventory count must be a positive integer: ${count}`);
    }
  }
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}
