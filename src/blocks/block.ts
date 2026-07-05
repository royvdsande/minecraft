/** Numeric block id as stored in a chunk's Uint16Array. 0 is always air. */
export type BlockId = number;

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
}
