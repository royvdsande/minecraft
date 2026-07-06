import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { Inventory } from './inventory';
import type { BlockRegistry } from '@/blocks/registry';
import type { BlockAtlas } from '@/render/texture-atlas';
import { UI_TEXTURES, uiTexture } from '@/render/ui-assets';

const UI_SCALE = 2;
const SOURCE_WIDTH = 240;
const SOURCE_HEIGHT = 29;
const SOURCE_SLOT_SIZE = 24;
const SLOT_SIZE = SOURCE_SLOT_SIZE * UI_SCALE;
const ICON_SIZE = 32;
const BOTTOM_MARGIN = 16;
const HOTBAR_SLOT_SOURCE_X = [3, 29, 56, 82, 109, 135, 161, 188, 214] as const;

interface SlotView {
  readonly frame: Graphics;
  readonly icon: Sprite;
  readonly count: Text;
}

export class HotbarView {
  readonly container = new Container();
  private readonly background = new Sprite(uiTexture(UI_TEXTURES.hotbar));
  private readonly selection = new Sprite(uiTexture(UI_TEXTURES.hotbarSelection));
  private readonly slots: SlotView[] = [];

  constructor(
    private readonly inventory: Inventory,
    private readonly registry: BlockRegistry,
    private readonly atlas: BlockAtlas,
  ) {
    this.container.label = 'hotbar';
    this.background.setSize(SOURCE_WIDTH * UI_SCALE, SOURCE_HEIGHT * UI_SCALE);
    this.container.addChild(this.background);

    this.selection.setSize(24 * UI_SCALE, 23 * UI_SCALE);
    this.container.addChild(this.selection);

    for (let i = 0; i < this.inventory.hotbarSize; i++) {
      this.slots.push(this.createSlot(i));
    }
    this.update();
  }

  layout(viewportWidth: number, viewportHeight: number): void {
    this.container.position.set(
      Math.round((viewportWidth - SOURCE_WIDTH * UI_SCALE) / 2),
      Math.round(viewportHeight - SOURCE_HEIGHT * UI_SCALE - BOTTOM_MARGIN),
    );
  }

  update(): void {
    for (let i = 0; i < this.slots.length; i++) {
      const view = this.slots[i];
      if (!view) continue;
      view.frame.clear();
      if (i === this.inventory.selectedIndex) {
        this.selection.position.set((this.sourceXForSlot(i) - 2) * UI_SCALE, 1 * UI_SCALE);
      }

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
        view.icon.setSize(ICON_SIZE, ICON_SIZE);
        view.icon.visible = true;
      }
      view.count.text = slot.count > 1 ? String(slot.count) : '';
    }
  }

  private createSlot(index: number): SlotView {
    const slot = new Container();
    slot.position.set(this.sourceXForSlot(index) * UI_SCALE, 3 * UI_SCALE);

    const frame = new Graphics();
    slot.addChild(frame);

    const icon = new Sprite(Texture.EMPTY);
    icon.position.set((SLOT_SIZE - ICON_SIZE) / 2, (SLOT_SIZE - ICON_SIZE) / 2);
    icon.setSize(ICON_SIZE, ICON_SIZE);
    icon.visible = false;
    slot.addChild(icon);

    const count = new Text({
      text: '',
      style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 12 },
    });
    count.anchor.set(1, 1);
    count.position.set(SLOT_SIZE - 8, SLOT_SIZE - 7);
    slot.addChild(count);

    this.container.addChild(slot);
    return { frame, icon, count };
  }

  private sourceXForSlot(index: number): number {
    const sourceX = HOTBAR_SLOT_SOURCE_X[index];
    if (sourceX === undefined) throw new RangeError(`Hotbar slot out of range: ${index}`);
    return sourceX;
  }
}
