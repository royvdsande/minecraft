/** Numeric block id as stored in a chunk's Uint16Array. 0 is always air. */
export type BlockId = number;

/** Right-click behaviour of a block that opens a UI (data-driven). */
export type BlockInteraction = 'crafting_table' | 'furnace' | 'chest';

/**
 * A stack of one block/item type. Shared by the player inventory, crafting
 * grids, chests, furnaces and ground drops.
 */
export interface ItemStack {
  readonly blockId: BlockId;
  readonly count: number;
}

/**
 * Data-driven block definition. Adding a block = adding one of these to the
 * register — never a new code path.
 */
export interface BlockDef {
  /** Stable string key, lower_snake_case, Minecraft-wiki name (`grass_block`). */
  readonly key: string;
  /** Human-readable display name. */
  readonly name: string;
  /** Whether entities collide with this block. */
  readonly solid: boolean;
  /**
   * Key of the texture in the block atlas (file name without `.png` in
   * `public/textures/blocks/`). `null` = never drawn (air).
   */
  readonly textureKey: string | null;
  /** Mining time baseline in seconds. `-1` = unbreakable (wiki convention). */
  readonly hardness: number;
  /** Block key dropped when mined, or `null` for no drop. */
  readonly drops: string | null;
  /**
   * Inventory-only item (stick, ingots, …): lives in stacks and recipes but
   * can never be placed in the world. Undefined ⇒ a placeable block.
   */
  readonly item?: true;
  /** Furnace burn time in seconds when used as fuel. Undefined ⇒ not a fuel. */
  readonly fuelSeconds?: number;
  /** UI opened by right-clicking this block in the world. */
  readonly interaction?: BlockInteraction;
}
