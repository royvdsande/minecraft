import { describe, it, expect } from 'vitest';
import { AIR, createBlockRegistry } from './registry';

describe('BlockRegistry', () => {
  it('assigns air id 0 (matches zero-filled chunk storage)', () => {
    const reg = createBlockRegistry();
    expect(reg.idOf('air')).toBe(AIR);
    expect(reg.byId(AIR).key).toBe('air');
    expect(reg.byId(AIR).solid).toBe(false);
    expect(reg.byId(AIR).textureKey).toBeNull();
  });

  it('round-trips key -> id -> def', () => {
    const reg = createBlockRegistry();
    const id = reg.idOf('stone');
    expect(id).toBeGreaterThan(0);
    expect(reg.byId(id).key).toBe('stone');
    expect(reg.byId(id).solid).toBe(true);
  });

  it('throws on unknown keys and ids', () => {
    const reg = createBlockRegistry();
    expect(() => reg.idOf('nope')).toThrow(/Unknown block key/);
    expect(() => reg.byId(9999)).toThrow(/Unknown block id/);
  });

  it('rejects duplicate keys', () => {
    const reg = createBlockRegistry();
    expect(() =>
      reg.register({
        key: 'stone',
        name: 'Stone again',
        solid: true,
        textureKey: 'stone',
        hardness: 1,
        drops: null,
      }),
    ).toThrow(/Duplicate block key/);
  });

  it('exposes drawable texture keys without duplicates or nulls', () => {
    const reg = createBlockRegistry();
    const keys = reg.textureKeys();
    expect(keys).toContain('stone');
    expect(keys).toContain('grass_block_side');
    expect(keys).not.toContain(null);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('models drops as data (grass drops dirt, bedrock drops nothing)', () => {
    const reg = createBlockRegistry();
    expect(reg.byId(reg.idOf('grass_block')).drops).toBe('dirt');
    expect(reg.byId(reg.idOf('bedrock')).drops).toBeNull();
    expect(reg.byId(reg.idOf('bedrock')).hardness).toBe(-1);
  });
});
