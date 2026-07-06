import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE } from '@/core/constants';
import { Chunk } from '@/world/chunk';
import { createChestEntity, createFurnaceEntity } from '@/world/block-entities';
import {
  SAVE_VERSION,
  deserializeChunk,
  deserializeGame,
  serializeChunk,
  serializeGame,
  type SerializeGameInput,
  type SerializedGame,
} from './save-data';

function gameInput(overrides: Partial<SerializeGameInput> = {}): SerializeGameInput {
  return {
    seed: 1234,
    chunks: [],
    inventory: [],
    blockEntities: [],
    player: { x: 0.5, y: 90, health: 20, hunger: 20, dayTime: 60 },
    savedAt: 99,
    ...overrides,
  };
}

describe('save data serialization', () => {
  it('round-trips a chunk without sharing block storage', () => {
    const chunk = new Chunk(-2);
    chunk.set(3, 10, 42);

    const data = serializeChunk(chunk);
    chunk.set(3, 10, 7);
    const restored = deserializeChunk(data);

    expect(restored.chunkX).toBe(-2);
    expect(restored.get(3, 10)).toBe(42);
  });

  it('serializes games with sorted chunks and metadata', () => {
    const left = new Chunk(-1);
    const right = new Chunk(2);

    const data = serializeGame(gameInput({ chunks: [right, left] }));

    expect(data.version).toBe(SAVE_VERSION);
    expect(data.seed).toBe(1234);
    expect(data.savedAt).toBe(99);
    expect(data.chunks.map((chunk) => chunk.chunkX)).toEqual([-1, 2]);
  });

  it('round-trips inventory, player state and block entities', () => {
    const chest = createChestEntity();
    chest.slots[3] = { blockId: 5, count: 12 };
    const furnace = createFurnaceEntity();
    furnace.input = { blockId: 12, count: 3 };
    furnace.burnRemaining = 4.5;
    furnace.burnTotal = 15;
    furnace.cookProgress = 2;

    const data = serializeGame(
      gameInput({
        inventory: [{ blockId: 2, count: 30 }, null],
        blockEntities: [
          { bx: 10, by: 90, entity: chest },
          { bx: -4, by: 88, entity: furnace },
        ],
      }),
    );
    const restored = deserializeGame(data);

    expect(restored.inventory).toEqual([{ blockId: 2, count: 30 }, null]);
    expect(restored.player).toEqual({ x: 0.5, y: 90, health: 20, hunger: 20, dayTime: 60 });

    const restoredChest = restored.blockEntities.find((e) => e.entity.kind === 'chest');
    expect(restoredChest?.bx).toBe(10);
    expect(restoredChest?.entity.kind === 'chest' && restoredChest.entity.slots[3]).toEqual({
      blockId: 5,
      count: 12,
    });

    const restoredFurnace = restored.blockEntities.find((e) => e.entity.kind === 'furnace');
    expect(restoredFurnace?.entity.kind === 'furnace' && restoredFurnace.entity.input).toEqual({
      blockId: 12,
      count: 3,
    });
    expect(restoredFurnace?.entity.kind === 'furnace' && restoredFurnace.entity.burnRemaining).toBe(
      4.5,
    );
  });

  it('still accepts v1 saves (chunks only) with defaults for the rest', () => {
    const chunk = new Chunk(5);
    chunk.set(1, 2, 9);
    const v1: SerializedGame = {
      version: 1,
      seed: 555,
      savedAt: 1,
      chunks: [serializeChunk(chunk)],
    };

    const restored = deserializeGame(v1);

    expect(restored.seed).toBe(555);
    expect(restored.chunks[0]?.get(1, 2)).toBe(9);
    expect(restored.inventory).toBeNull();
    expect(restored.blockEntities).toEqual([]);
    expect(restored.player).toBeNull();
  });

  it('rejects invalid chunk payloads', () => {
    expect(() => deserializeChunk({ chunkX: 0.5, blocks: new Uint16Array(CHUNK_SIZE) })).toThrow(
      RangeError,
    );
    expect(() => deserializeChunk({ chunkX: 0, blocks: new Uint16Array(1) })).toThrow(RangeError);
  });

  it('rejects unsupported save versions and invalid seeds', () => {
    const valid = serializeGame(gameInput());

    expect(() => serializeGame(gameInput({ seed: -1 }))).toThrow(RangeError);
    expect(() => deserializeGame({ ...valid, version: 999 })).toThrow(/Unsupported save version/);
    expect(() => deserializeGame({ ...valid, seed: 0.5 })).toThrow(RangeError);
  });
});
