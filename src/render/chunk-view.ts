import { Container, Sprite } from 'pixi.js';
import { CHUNK_WIDTH, WORLD_HEIGHT } from '@/core/constants';
import type { Chunk } from '@/world/chunk';
import type { BlockRegistry } from '@/blocks/registry';
import type { BlockAtlas } from './texture-atlas';

/**
 * Display for one chunk: one 1x1-block sprite per non-air cell, positioned in
 * WORLD BLOCK UNITS (the camera scales the parent container to pixels). All
 * sprites share the atlas texture source.
 *
 * Sprites are tracked per cell so a single block edit updates in O(1) instead
 * of rebuilding the whole chunk (used by break/place in M3).
 */
export class ChunkView {
  readonly container = new Container();
  private readonly sprites = new Map<number, Sprite>();

  constructor(
    private readonly chunk: Chunk,
    private readonly registry: BlockRegistry,
    private readonly atlas: BlockAtlas,
  ) {
    this.container.label = `chunk:${chunk.chunkX}`;
    for (let y = 0; y < WORLD_HEIGHT; y++) {
      for (let lx = 0; lx < CHUNK_WIDTH; lx++) this.sync(lx, y);
    }
  }

  /** Re-sync one cell's sprite to the chunk's current block there. */
  update(localX: number, y: number): void {
    this.sync(localX, y);
  }

  private sync(localX: number, y: number): void {
    const key = y * CHUNK_WIDTH + localX;
    const textureKey = this.registry.byId(this.chunk.get(localX, y)).textureKey;
    const existing = this.sprites.get(key);

    if (textureKey === null) {
      if (existing) {
        this.container.removeChild(existing);
        existing.destroy();
        this.sprites.delete(key);
      }
      return;
    }

    if (existing) {
      existing.texture = this.atlas.texture(textureKey);
      return;
    }

    const sprite = new Sprite(this.atlas.texture(textureKey));
    sprite.position.set(this.chunk.chunkX * CHUNK_WIDTH + localX, y);
    sprite.setSize(1, 1); // block units
    this.container.addChild(sprite);
    this.sprites.set(key, sprite);
  }
}
