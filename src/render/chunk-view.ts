import { Container, Sprite } from 'pixi.js';
import { CHUNK_WIDTH, WORLD_HEIGHT } from '@/core/constants';
import type { Chunk } from '@/world/chunk';
import type { BlockRegistry } from '@/blocks/registry';
import type { BlockAtlas } from './texture-atlas';

/**
 * Build the display container for one chunk: one 1x1-block sprite per non-air
 * cell, positioned in WORLD BLOCK UNITS (the camera scales the parent
 * container to pixels). All sprites share the atlas texture source.
 *
 * Static for M1 — rebuild-on-change and pooling arrive with M3/M5.
 */
export function createChunkView(
  chunk: Chunk,
  registry: BlockRegistry,
  atlas: BlockAtlas,
): Container {
  const view = new Container();
  view.label = `chunk:${chunk.chunkX}`;

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lx = 0; lx < CHUNK_WIDTH; lx++) {
      const id = chunk.get(lx, y);
      const textureKey = registry.byId(id).textureKey;
      if (textureKey === null) continue; // air

      const sprite = new Sprite(atlas.texture(textureKey));
      sprite.position.set(chunk.chunkX * CHUNK_WIDTH + lx, y);
      sprite.setSize(1, 1); // block units
      view.addChild(sprite);
    }
  }

  return view;
}
