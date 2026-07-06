import { Container, Sprite } from 'pixi.js';
import type { BlockRegistry } from '@/blocks/registry';
import { DROP_SIZE, type ItemDrop } from '@/entity/item-drop';
import type { BlockAtlas } from './texture-atlas';

/**
 * Renders ground item drops as small floating sprites in world block units.
 * Sprites are keyed by drop id and synced against the manager's list each
 * frame; a subtle bob makes them readable against terrain.
 */
export class ItemDropView {
  readonly container = new Container();
  private readonly sprites = new Map<number, Sprite>();

  constructor(
    private readonly registry: BlockRegistry,
    private readonly atlas: BlockAtlas,
  ) {
    this.container.label = 'item-drops';
  }

  sync(drops: readonly ItemDrop[]): void {
    const live = new Set<number>();

    for (const drop of drops) {
      live.add(drop.id);
      let sprite = this.sprites.get(drop.id);
      if (!sprite) {
        const textureKey = this.registry.byId(drop.blockId).textureKey;
        if (textureKey === null) continue;
        sprite = new Sprite(this.atlas.texture(textureKey));
        sprite.setSize(DROP_SIZE, DROP_SIZE);
        this.sprites.set(drop.id, sprite);
        this.container.addChild(sprite);
      }
      const bob = Math.sin(drop.age * 3) * 0.05;
      sprite.position.set(drop.x - DROP_SIZE / 2, drop.y - DROP_SIZE + bob);
    }

    for (const [id, sprite] of this.sprites) {
      if (live.has(id)) continue;
      this.container.removeChild(sprite);
      sprite.destroy();
      this.sprites.delete(id);
    }
  }

  destroy(): void {
    this.sprites.clear();
    this.container.destroy({ children: true });
  }
}
