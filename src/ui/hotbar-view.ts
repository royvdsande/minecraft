import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Inventory } from './inventory';
import type { BlockRegistry } from '@/blocks/registry';
import type { BlockAtlas } from '@/render/texture-atlas';

const SLOT_SIZE = 40;
const SLOT_GAP = 4;
const ICON_SIZE = 28;
const BOTTOM_MARGIN = 18;

interface SlotView {
  readonly frame: Graphics;
  readonly icon: Sprite;
  readonly count: Text;
  readonly key: Text;
}

export class HotbarView {
  readonly container = new Container();
  private readonly slots: SlotView[] = [];

  constructor(
    private readonly inventory: Inventory,
    private readonly registry: BlockRegistry,
    private readonly atlas: BlockAtlas,
  ) {
    this.container.label = 'hotbar';
    for (let i = 0; i < this.inventory.size; i++) {
      this.slots.push(this.createSlot(i));
    }
    this.update();
  }

  layout(viewportWidth: number, viewportHeight: number): void {
    const totalWidth = this.inventory.size * SLOT_SIZE + (this.inventory.size - 1) * SLOT_GAP;
    this.container.position.set(
      Math.round((viewportWidth - totalWidth) / 2),
      Math.round(viewportHeight - SLOT_SIZE - BOTTOM_MARGIN),
    );
  }

  update(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const view = this.slots[i];
      if (!view) continue;
      this.drawFrame(view.frame, i === this.inventory.selectedIndex);

      const slot = this.inventory.slot(i);
      if (!slot) {
        view.icon.visible = false;
        view.count.text = '';
        continue;
      }

      const textureKey = this.registry.byId(slot.blockId).textureKey;
      if (textureKey === null) {
        view.icon.visible = false;
      } else {
        view.icon.texture = this.atlas.texture(textureKey);
        view.icon.visible = true;
      }
      view.count.text = slot.count > 1 ? String(slot.count) : '';
    }
  }

  private createSlot(index: number): SlotView {
    const slot = new Container();
    slot.position.set(index * (SLOT_SIZE + SLOT_GAP), 0);

    const frame = new Graphics();
    slot.addChild(frame);

    const icon = new Sprite(Texture.EMPTY);
    icon.position.set((SLOT_SIZE - ICON_SIZE) / 2, (SLOT_SIZE - ICON_SIZE) / 2);
    icon.setSize(ICON_SIZE, ICON_SIZE);
    icon.visible = false;
    slot.addChild(icon);

    const key = new Text({
      text: String(index + 1),
      style: { fill: '#cfd6e6', fontFamily: 'monospace', fontSize: 10 },
    });
    key.position.set(4, 2);
    slot.addChild(key);

    const count = new Text({
      text: '',
      style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 12 },
    });
    count.anchor.set(1, 1);
    count.position.set(SLOT_SIZE - 4, SLOT_SIZE - 3);
    slot.addChild(count);

    this.container.addChild(slot);
    return { frame, icon, count, key };
  }

  private drawFrame(frame: Graphics, selected: boolean): void {
    frame
      .clear()
      .rect(0, 0, SLOT_SIZE, SLOT_SIZE)
      .fill(selected ? 0x3a4050 : 0x171a20)
      .stroke({ width: selected ? 3 : 1, color: selected ? 0xf4d35e : 0x6b7280 });
  }
}
