import type { BlockDef, BlockId } from './block';

/** Air is always id 0 — the default value of a zero-filled Uint16Array. */
export const AIR: BlockId = 0;

/**
 * Central id -> BlockDef register.
 *
 * IMPORTANT: numeric ids are assigned by registration order and end up in
 * world saves (M7). The default registration list below is therefore
 * APPEND-ONLY: never reorder or remove entries, only add at the end.
 */
export class BlockRegistry {
  private readonly defs: BlockDef[] = [];
  private readonly keyToId = new Map<string, BlockId>();

  register(def: BlockDef): BlockId {
    if (this.keyToId.has(def.key)) {
      throw new Error(`Duplicate block key: ${def.key}`);
    }
    const id = this.defs.length;
    this.defs.push(def);
    this.keyToId.set(def.key, id);
    return id;
  }

  byId(id: BlockId): BlockDef {
    const def = this.defs[id];
    if (!def) throw new Error(`Unknown block id: ${id}`);
    return def;
  }

  idOf(key: string): BlockId {
    const id = this.keyToId.get(key);
    if (id === undefined) throw new Error(`Unknown block key: ${key}`);
    return id;
  }

  has(key: string): boolean {
    return this.keyToId.has(key);
  }

  get count(): number {
    return this.defs.length;
  }

  get all(): readonly BlockDef[] {
    return this.defs;
  }

  /** Unique texture keys of all drawable blocks (input for the atlas). */
  textureKeys(): string[] {
    const keys = new Set<string>();
    for (const def of this.defs) {
      if (def.textureKey !== null) keys.add(def.textureKey);
    }
    return [...keys];
  }
}

/**
 * The default block set. Data only — see BlockRegistry docs for the
 * append-only rule. Air MUST stay first (id 0).
 */
const DEFAULT_BLOCKS: readonly BlockDef[] = [
  { key: 'air', name: 'Air', solid: false, textureKey: null, hardness: 0, drops: null },
  {
    key: 'stone',
    name: 'Stone',
    solid: true,
    textureKey: 'stone',
    hardness: 1.5,
    drops: 'cobblestone',
  },
  { key: 'dirt', name: 'Dirt', solid: true, textureKey: 'dirt', hardness: 0.5, drops: 'dirt' },
  {
    key: 'grass_block',
    name: 'Grass Block',
    solid: true,
    textureKey: 'grass_block_side',
    hardness: 0.6,
    drops: 'dirt',
  },
  {
    key: 'cobblestone',
    name: 'Cobblestone',
    solid: true,
    textureKey: 'cobblestone',
    hardness: 2,
    drops: 'cobblestone',
  },
  { key: 'sand', name: 'Sand', solid: true, textureKey: 'sand', hardness: 0.5, drops: 'sand' },
  {
    key: 'gravel',
    name: 'Gravel',
    solid: true,
    textureKey: 'gravel',
    hardness: 0.6,
    drops: 'gravel',
  },
  // Trees live on a background layer: entities walk in front of logs/leaves
  // instead of colliding with them (same for the functional blocks below).
  {
    key: 'oak_log',
    name: 'Oak Log',
    solid: false,
    textureKey: 'oak_log',
    hardness: 2,
    drops: 'oak_log',
    fuelSeconds: 15,
  },
  {
    key: 'oak_planks',
    name: 'Oak Planks',
    solid: true,
    textureKey: 'oak_planks',
    hardness: 2,
    drops: 'oak_planks',
    fuelSeconds: 15,
  },
  {
    key: 'oak_leaves',
    name: 'Oak Leaves',
    solid: false,
    textureKey: 'oak_leaves',
    hardness: 0.2,
    drops: null,
  },
  {
    key: 'bedrock',
    name: 'Bedrock',
    solid: true,
    textureKey: 'bedrock',
    hardness: -1,
    drops: null,
  },
  {
    key: 'coal_ore',
    name: 'Coal Ore',
    solid: true,
    textureKey: 'coal_ore',
    hardness: 3,
    drops: 'coal',
  },
  {
    key: 'iron_ore',
    name: 'Iron Ore',
    solid: true,
    textureKey: 'iron_ore',
    hardness: 3,
    drops: 'iron_ore',
  },
  // Non-solid: entities pass through (swim/buoyancy physics come later).
  // Unbreakable by hand (hardness < 0); a bucket handles it in a later scope.
  {
    key: 'water',
    name: 'Water',
    solid: false,
    textureKey: 'water_still',
    hardness: -1,
    drops: null,
  },
  // --- Post-M8 additions (append-only!) ---
  // Functional blocks sit on the background layer (non-solid) so the player
  // never bumps into their own crafting table / furnace / chest.
  {
    key: 'crafting_table',
    name: 'Crafting Table',
    solid: false,
    textureKey: 'crafting_table_front',
    hardness: 2.5,
    drops: 'crafting_table',
    fuelSeconds: 15,
    interaction: 'crafting_table',
  },
  {
    key: 'furnace',
    name: 'Furnace',
    solid: false,
    textureKey: 'furnace_front',
    hardness: 3.5,
    drops: 'furnace',
    interaction: 'furnace',
  },
  {
    key: 'chest',
    name: 'Chest',
    solid: false,
    textureKey: 'chest_front',
    hardness: 2.5,
    drops: 'chest',
    fuelSeconds: 15,
    interaction: 'chest',
  },
  {
    key: 'gold_ore',
    name: 'Gold Ore',
    solid: true,
    textureKey: 'gold_ore',
    hardness: 3,
    drops: 'gold_ore',
  },
  {
    key: 'diamond_ore',
    name: 'Diamond Ore',
    solid: true,
    textureKey: 'diamond_ore',
    hardness: 3,
    drops: 'diamond',
  },
  { key: 'glass', name: 'Glass', solid: true, textureKey: 'glass', hardness: 0.3, drops: null },
  // Inventory-only items (never placeable in the world).
  {
    key: 'stick',
    name: 'Stick',
    solid: false,
    textureKey: 'stick',
    hardness: 0,
    drops: null,
    item: true,
    fuelSeconds: 5,
  },
  {
    key: 'coal',
    name: 'Coal',
    solid: false,
    textureKey: 'coal',
    hardness: 0,
    drops: null,
    item: true,
    fuelSeconds: 80,
  },
  {
    key: 'charcoal',
    name: 'Charcoal',
    solid: false,
    textureKey: 'charcoal',
    hardness: 0,
    drops: null,
    item: true,
    fuelSeconds: 80,
  },
  {
    key: 'iron_ingot',
    name: 'Iron Ingot',
    solid: false,
    textureKey: 'iron_ingot',
    hardness: 0,
    drops: null,
    item: true,
  },
  {
    key: 'gold_ingot',
    name: 'Gold Ingot',
    solid: false,
    textureKey: 'gold_ingot',
    hardness: 0,
    drops: null,
    item: true,
  },
  {
    key: 'diamond',
    name: 'Diamond',
    solid: false,
    textureKey: 'diamond',
    hardness: 0,
    drops: null,
    item: true,
  },
];

/** Build a registry with the default block set registered. */
export function createBlockRegistry(): BlockRegistry {
  const registry = new BlockRegistry();
  for (const def of DEFAULT_BLOCKS) registry.register(def);
  return registry;
}
