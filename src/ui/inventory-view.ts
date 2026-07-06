import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import type { BlockRegistry } from '@/blocks/registry';
import type { BlockAtlas } from '@/render/texture-atlas';
import { UI_TEXTURES, uiTexture } from '@/render/ui-assets';
import type { Inventory, InventorySlot } from './inventory';
import {
  CRAFTING_GRID_SIZE,
  HOTBAR_SIZE,
  INVENTORY_COLUMNS,
  MAIN_INVENTORY_ROWS,
  MAX_STACK_SIZE,
} from './inventory';
import {
  consumeCraftingIngredients,
  craftingResult,
  findCraftingRecipe,
  type CraftingRecipe,
} from './crafting';

const UI_SCALE = 2;
const SOURCE_PANEL_WIDTH = 166;
const SOURCE_PANEL_HEIGHT = 158;
const PANEL_WIDTH = SOURCE_PANEL_WIDTH * UI_SCALE;
const PANEL_HEIGHT = SOURCE_PANEL_HEIGHT * UI_SCALE;
const SLOT_SIZE = 18 * UI_SCALE;
const ICON_SIZE = 32;
const MAIN_X = 4 * UI_SCALE;
const MAIN_Y = 76 * UI_SCALE;
const HOTBAR_Y = 140 * UI_SCALE;
const CRAFT_X = 91 * UI_SCALE;
const CRAFT_Y = 18 * UI_SCALE;
const RESULT_X = 145 * UI_SCALE;
const RESULT_Y = 29 * UI_SCALE;

type SlotKind = 'inventory' | 'crafting' | 'result';

interface SlotView {
  readonly frame: Graphics;
  readonly icon: Sprite;
  readonly count: Text;
  readonly kind: SlotKind;
  readonly index: number;
}

export class InventoryView {
  readonly container = new Container();
  private readonly panel = new Graphics();
  private readonly background = new Sprite(inventoryPanelTexture());
  private readonly slotViews: SlotView[] = [];
  private readonly cursor = new Container();
  private readonly cursorIcon = new Sprite(Texture.EMPTY);
  private readonly cursorCount = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 12 },
  });
  private cursorSlot: InventorySlot | null = null;
  private open = false;

  constructor(
    private readonly inventory: Inventory,
    private readonly registry: BlockRegistry,
    private readonly atlas: BlockAtlas,
    private readonly recipes: readonly CraftingRecipe[],
  ) {
    this.container.label = 'inventory';
    this.container.visible = false;
    this.container.eventMode = 'static';

    const backdrop = new Graphics();
    backdrop.rect(0, 0, 1, 1).fill({ color: 0x000000, alpha: 0.38 });
    this.container.addChild(backdrop);
    this.container.addChild(this.panel);

    this.background.setSize(PANEL_WIDTH, PANEL_HEIGHT);
    this.panel.addChild(this.background);

    this.createInventorySlots();
    this.createCraftingSlots();
    this.createResultSlot();
    this.createCursor();
    this.update();
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean): void {
    this.open = open;
    this.container.visible = open;
    if (!open) this.returnCursorToInventory();
    this.update();
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  layout(viewportWidth: number, viewportHeight: number): void {
    const backdrop = this.container.children[0] as Graphics | undefined;
    if (backdrop) {
      backdrop
        .clear()
        .rect(0, 0, viewportWidth, viewportHeight)
        .fill({ color: 0x000000, alpha: 0.38 });
    }

    this.panel.position.set(
      Math.round((viewportWidth - PANEL_WIDTH) / 2),
      Math.round((viewportHeight - PANEL_HEIGHT) / 2),
    );
  }

  setPointer(x: number, y: number): void {
    this.cursor.position.set(Math.round(x + 10), Math.round(y + 10));
  }

  update(): void {
    for (const slot of this.slotViews) {
      const item = this.itemForSlot(slot);
      this.drawSlot(slot.frame, slot.kind === 'result');
      this.drawItem(slot.icon, slot.count, item);
    }
    this.drawCursor();
  }

  private createInventorySlots(): void {
    for (let row = 0; row < MAIN_INVENTORY_ROWS; row++) {
      for (let col = 0; col < INVENTORY_COLUMNS; col++) {
        const index = HOTBAR_SIZE + row * INVENTORY_COLUMNS + col;
        this.createSlot('inventory', index, MAIN_X + col * SLOT_SIZE, MAIN_Y + row * SLOT_SIZE);
      }
    }

    for (let col = 0; col < HOTBAR_SIZE; col++) {
      this.createSlot('inventory', col, MAIN_X + col * SLOT_SIZE, HOTBAR_Y);
    }
  }

  private createCraftingSlots(): void {
    for (let i = 0; i < CRAFTING_GRID_SIZE; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      this.createSlot('crafting', i, CRAFT_X + col * SLOT_SIZE, CRAFT_Y + row * SLOT_SIZE);
    }
  }

  private createResultSlot(): void {
    this.createSlot('result', 0, RESULT_X, RESULT_Y);
  }

  private createSlot(kind: SlotKind, index: number, x: number, y: number): void {
    const slot = new Container();
    slot.position.set(x, y);
    slot.eventMode = 'static';
    slot.cursor = 'pointer';
    slot.on('pointertap', () => this.handleSlotClick(kind, index));

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
    count.position.set(SLOT_SIZE - 3, SLOT_SIZE - 2);
    slot.addChild(count);

    this.panel.addChild(slot);
    this.slotViews.push({ frame, icon, count, kind, index });
  }

  private createCursor(): void {
    this.cursor.visible = false;
    this.cursorIcon.setSize(ICON_SIZE, ICON_SIZE);
    this.cursor.addChild(this.cursorIcon);
    this.cursorCount.anchor.set(1, 1);
    this.cursorCount.position.set(ICON_SIZE + 5, ICON_SIZE + 4);
    this.cursor.addChild(this.cursorCount);
    this.container.addChild(this.cursor);
  }

  private drawSlot(frame: Graphics, _result: boolean): void {
    frame.clear().rect(0, 0, SLOT_SIZE, SLOT_SIZE).fill({ color: 0xffffff, alpha: 0.001 });
  }

  private drawItem(icon: Sprite, count: Text, slot: InventorySlot | null): void {
    if (!slot) {
      icon.visible = false;
      count.text = '';
      return;
    }

    const textureKey = this.registry.byId(slot.blockId).textureKey;
    if (textureKey === null) {
      icon.visible = false;
    } else {
      icon.texture = this.atlas.texture(textureKey);
      icon.setSize(ICON_SIZE, ICON_SIZE);
      icon.visible = true;
    }
    count.text = slot.count > 1 ? String(slot.count) : '';
  }

  private drawCursor(): void {
    this.cursor.visible = this.cursorSlot !== null;
    if (!this.cursorSlot) return;
    this.drawItem(this.cursorIcon, this.cursorCount, this.cursorSlot);
  }

  private itemForSlot(slot: SlotView): InventorySlot | null {
    if (slot.kind === 'inventory') return this.inventory.slot(slot.index);
    if (slot.kind === 'crafting') return this.inventory.craftingSlot(slot.index);
    return craftingResult(this.inventory.craftingSnapshot(), this.recipes);
  }

  private handleSlotClick(kind: SlotKind, index: number): void {
    if (kind === 'result') this.takeCraftingResult();
    else if (kind === 'inventory') this.interactInventorySlot(index);
    else this.interactCraftingSlot(index);
    this.update();
  }

  private interactInventorySlot(index: number): void {
    const next = mergeOrSwap(this.inventory.slot(index), this.cursorSlot);
    this.inventory.setSlot(index, next.target);
    this.cursorSlot = next.cursor;
  }

  private interactCraftingSlot(index: number): void {
    const next = mergeOrSwap(this.inventory.craftingSlot(index), this.cursorSlot);
    this.inventory.setCraftingSlot(index, next.target);
    this.cursorSlot = next.cursor;
  }

  private takeCraftingResult(): void {
    const recipe = findCraftingRecipe(this.inventory.craftingSnapshot(), this.recipes);
    if (!recipe) return;

    const result = recipe.result;
    if (!canAcceptResult(this.cursorSlot, result)) return;

    this.cursorSlot = addToCursor(this.cursorSlot, result);
    consumeCraftingIngredients(this.inventory, recipe);
  }

  private returnCursorToInventory(): void {
    if (!this.cursorSlot) return;
    const leftover = this.inventory.add(this.cursorSlot.blockId, this.cursorSlot.count);
    this.cursorSlot = leftover > 0 ? { blockId: this.cursorSlot.blockId, count: leftover } : null;
  }
}

function mergeOrSwap(
  target: InventorySlot | null,
  cursor: InventorySlot | null,
): { target: InventorySlot | null; cursor: InventorySlot | null } {
  if (!cursor) return { target: null, cursor: target };
  if (!target) return { target: cursor, cursor: null };

  if (target.blockId === cursor.blockId && target.count < MAX_STACK_SIZE) {
    const moved = Math.min(cursor.count, MAX_STACK_SIZE - target.count);
    return {
      target: { blockId: target.blockId, count: target.count + moved },
      cursor:
        cursor.count > moved ? { blockId: cursor.blockId, count: cursor.count - moved } : null,
    };
  }

  return { target: cursor, cursor: target };
}

function canAcceptResult(cursor: InventorySlot | null, result: InventorySlot): boolean {
  if (!cursor) return true;
  return cursor.blockId === result.blockId && cursor.count + result.count <= MAX_STACK_SIZE;
}

function addToCursor(cursor: InventorySlot | null, result: InventorySlot): InventorySlot {
  if (!cursor) return { ...result };
  return { blockId: cursor.blockId, count: cursor.count + result.count };
}

function inventoryPanelTexture(): Texture {
  const base = uiTexture(UI_TEXTURES.inventory);
  return new Texture({
    source: base.source,
    frame: new Rectangle(0, 0, SOURCE_PANEL_WIDTH, SOURCE_PANEL_HEIGHT),
  });
}
