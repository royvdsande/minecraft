import { CHUNK_SIZE } from '@/core/constants';
import { Chunk } from '@/world/chunk';
import type { ItemStack } from '@/blocks/block';
import {
  CHEST_SIZE,
  createChestEntity,
  createFurnaceEntity,
  type BlockEntity,
} from '@/world/block-entities';

export const SAVE_VERSION = 2;

export interface SerializedChunk {
  readonly chunkX: number;
  readonly blocks: Uint16Array;
}

export interface SerializedBlockEntity {
  readonly bx: number;
  readonly by: number;
  readonly kind: 'chest' | 'furnace';
  /** Chest: CHEST_SIZE slots. Furnace: [input, fuel, output]. */
  readonly slots: ReadonlyArray<ItemStack | null>;
  readonly burnRemaining?: number;
  readonly burnTotal?: number;
  readonly cookProgress?: number;
}

export interface SerializedPlayer {
  readonly x: number;
  readonly y: number;
  readonly health: number;
  readonly hunger: number;
  readonly dayTime: number;
}

export interface SerializedGame {
  readonly version: number;
  readonly seed: number;
  readonly savedAt: number;
  readonly chunks: readonly SerializedChunk[];
  /** v2+ — absent in v1 saves. */
  readonly inventory?: ReadonlyArray<ItemStack | null>;
  readonly blockEntities?: readonly SerializedBlockEntity[];
  readonly player?: SerializedPlayer;
}

export interface DeserializedGame {
  readonly seed: number;
  readonly chunks: Chunk[];
  readonly inventory: ReadonlyArray<ItemStack | null> | null;
  readonly blockEntities: Array<{ bx: number; by: number; entity: BlockEntity }>;
  readonly player: SerializedPlayer | null;
}

export function serializeChunk(chunk: Chunk): SerializedChunk {
  return {
    chunkX: chunk.chunkX,
    blocks: new Uint16Array(chunk.blocks),
  };
}

export function deserializeChunk(data: SerializedChunk): Chunk {
  if (!Number.isInteger(data.chunkX)) {
    throw new RangeError(`Saved chunkX must be an integer: ${data.chunkX}`);
  }
  if (!(data.blocks instanceof Uint16Array) || data.blocks.length !== CHUNK_SIZE) {
    throw new RangeError(`Saved chunk ${data.chunkX} has invalid block storage`);
  }

  const chunk = new Chunk(data.chunkX);
  chunk.blocks.set(data.blocks);
  return chunk;
}

export function serializeBlockEntity(
  bx: number,
  by: number,
  entity: BlockEntity,
): SerializedBlockEntity {
  if (entity.kind === 'chest') {
    return { bx, by, kind: 'chest', slots: entity.slots.map(copyStack) };
  }
  return {
    bx,
    by,
    kind: 'furnace',
    slots: [entity.input, entity.fuel, entity.output].map(copyStack),
    burnRemaining: entity.burnRemaining,
    burnTotal: entity.burnTotal,
    cookProgress: entity.cookProgress,
  };
}

export function deserializeBlockEntity(data: SerializedBlockEntity): {
  bx: number;
  by: number;
  entity: BlockEntity;
} {
  if (!Number.isInteger(data.bx) || !Number.isInteger(data.by)) {
    throw new RangeError(`Saved block entity has invalid position: (${data.bx}, ${data.by})`);
  }

  if (data.kind === 'chest') {
    const chest = createChestEntity();
    for (let i = 0; i < CHEST_SIZE; i++) chest.slots[i] = copyStack(data.slots[i] ?? null);
    return { bx: data.bx, by: data.by, entity: chest };
  }

  const furnace = createFurnaceEntity();
  furnace.input = copyStack(data.slots[0] ?? null);
  furnace.fuel = copyStack(data.slots[1] ?? null);
  furnace.output = copyStack(data.slots[2] ?? null);
  furnace.burnRemaining = finiteOrZero(data.burnRemaining);
  furnace.burnTotal = finiteOrZero(data.burnTotal);
  furnace.cookProgress = finiteOrZero(data.cookProgress);
  return { bx: data.bx, by: data.by, entity: furnace };
}

export interface SerializeGameInput {
  readonly seed: number;
  readonly chunks: Iterable<Chunk>;
  readonly inventory: ReadonlyArray<ItemStack | null>;
  readonly blockEntities: ReadonlyArray<{ bx: number; by: number; entity: BlockEntity }>;
  readonly player: SerializedPlayer;
  readonly savedAt?: number;
}

export function serializeGame(input: SerializeGameInput): SerializedGame {
  const { seed, savedAt = Date.now() } = input;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError(`Seed must be a uint32: ${seed}`);
  }
  if (!Number.isFinite(savedAt)) {
    throw new RangeError(`savedAt must be finite: ${savedAt}`);
  }

  const serializedChunks = [...input.chunks]
    .map(serializeChunk)
    .sort((a, b) => a.chunkX - b.chunkX);
  return {
    version: SAVE_VERSION,
    seed,
    savedAt,
    chunks: serializedChunks,
    inventory: input.inventory.map(copyStack),
    blockEntities: input.blockEntities.map((e) => serializeBlockEntity(e.bx, e.by, e.entity)),
    player: { ...input.player },
  };
}

/** Accepts v1 (chunks only) and v2 saves; missing v2 fields become defaults. */
export function deserializeGame(data: SerializedGame): DeserializedGame {
  if (data.version !== 1 && data.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${data.version}`);
  }
  if (!Number.isInteger(data.seed) || data.seed < 0 || data.seed > 0xffffffff) {
    throw new RangeError(`Saved seed must be a uint32: ${data.seed}`);
  }

  return {
    seed: data.seed,
    chunks: data.chunks.map(deserializeChunk),
    inventory: data.inventory?.map(copyStack) ?? null,
    blockEntities: (data.blockEntities ?? []).map(deserializeBlockEntity),
    player: data.player ? { ...data.player } : null,
  };
}

function copyStack(stack: ItemStack | null | undefined): ItemStack | null {
  if (!stack || !Number.isInteger(stack.blockId) || stack.blockId <= 0) return null;
  if (!Number.isInteger(stack.count) || stack.count <= 0) return null;
  return { blockId: stack.blockId, count: stack.count };
}

function finiteOrZero(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}
