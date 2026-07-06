import type { FederatedPointerEvent } from 'pixi.js';
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { ItemStack } from '@/blocks/block';
import type { BlockRegistry } from '@/blocks/registry';
import type { BlockAtlas } from '@/render/texture-atlas';
import type { ChestEntity, FurnaceEntity } from '@/world/block-entities';
import { furnaceGauges } from '@/world/furnace';
import type { Inventory } from './inventory';
import { HOTBAR_SIZE, INVENTORY_COLUMNS, MAIN_INVENTORY_ROWS, MAX_STACK_SIZE } from './inventory';
import { ItemGrid } from './item-grid';
import {
  consumeCraftingIngredients,
  craftingResult,
  findCraftingRecipe,
  type CraftingRecipe,
} from './crafting';

/**
 * The container GUI: player inventory (2x2 crafting), crafting table (3x3),
 * chest (27 slots) and furnace (input/fuel/output + gauges). One generic
 * slot/cursor system powers all screens:
 *
 * - left-click: pick up / place / merge / swap
 * - right-click: pick up half / place a single item
 * - shift-click: quick-move to the counterpart area (crafts a full stack on
 *   result slots)
 * - hovering shows a highlight + name tooltip
 *
 * Closing a screen returns crafting-grid and cursor items to the inventory;
 * anything that does not fit is handed to `onOverflow` (dropped on the ground).
 */

export type ContainerScreen =
  | { readonly kind: 'inventory' }
  | { readonly kind: 'crafting_table' }
  | { readonly kind: 'chest'; readonly entity: ChestEntity }
  | { readonly kind: 'furnace'; readonly entity: FurnaceEntity };

type SlotRef =
  | { readonly area: 'inventory'; readonly index: number }
  | { readonly area: 'craft'; readonly index: number }
  | { readonly area: 'result' }
  | { readonly area: 'chest'; readonly index: number }
  | { readonly area: 'furnace'; readonly slot: 'input' | 'fuel' | 'output' };

interface SlotView {
  readonly root: Container;
  readonly frame: Graphics;
  readonly icon: Sprite;
  readonly count: Text;
  readonly ref: SlotRef;
}

export interface InventoryViewCallbacks {
  /** Something changed that is worth persisting (slot edits, crafting, …). */
  onChange?: () => void;
  /** Items that no longer fit anywhere on close — drop them in the world. */
  onOverflow?: (stack: ItemStack) => void;
}

const SLOT_SIZE = 36;
const SLOT_GAP = 4;
const ICON_SIZE = 28;
const MARGIN = 18;
const TITLE_HEIGHT = 26;
const SECTION_GAP = 14;
const PANEL_WIDTH = MARGIN * 2 + INVENTORY_COLUMNS * SLOT_SIZE + (INVENTORY_COLUMNS - 1) * SLOT_GAP;

const COLOR_PANEL = 0xc6c6c6;
const COLOR_PANEL_BORDER = 0x2d2d2d;
const COLOR_SLOT = 0x8b8b8b;
const COLOR_SLOT_RESULT = 0xdedede;
const COLOR_SLOT_BORDER_DARK = 0x373737;
const COLOR_SLOT_BORDER_LIGHT = 0xffffff;
const COLOR_TEXT = 0x3f3f3f;

export class InventoryView {
  readonly container = new Container();
  private readonly backdrop = new Graphics();
  private readonly panel = new Container();
  private readonly panelBg = new Graphics();
  private readonly widgets = new Graphics();
  private readonly title = new Text({
    text: '',
    style: { fill: COLOR_TEXT, fontFamily: 'monospace', fontSize: 15 },
  });
  private readonly slotViews: SlotView[] = [];

  private readonly cursorLayer = new Container();
  private readonly cursorIcon = new Sprite(Texture.EMPTY);
  private readonly cursorCount = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 13 },
  });
  private readonly tooltip = new Container();
  private readonly tooltipBg = new Graphics();
  private readonly tooltipText = new Text({
    text: '',
    style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 13 },
  });

  private screen: ContainerScreen | null = null;
  private craftGrid = new ItemGrid(4);
  private cursorStack: ItemStack | null = null;
  private hovered: SlotRef | null = null;
  private panelHeight = 0;
  private viewportWidth = 0;
  private viewportHeight = 0;

  constructor(
    private readonly inventory: Inventory,
    private readonly registry: BlockRegistry,
    private readonly atlas: BlockAtlas,
    private readonly recipes: readonly CraftingRecipe[],
    private readonly callbacks: InventoryViewCallbacks = {},
  ) {
    this.container.label = 'container-gui';
    this.container.visible = false;
    this.container.eventMode = 'static';

    this.backdrop.eventMode = 'static';
    this.container.addChild(this.backdrop);
    this.panel.addChild(this.panelBg);
    this.panel.addChild(this.widgets);
    this.panel.addChild(this.title);
    this.container.addChild(this.panel);

    this.cursorIcon.setSize(ICON_SIZE, ICON_SIZE);
    this.cursorCount.anchor.set(1, 1);
    this.cursorCount.position.set(ICON_SIZE + 4, ICON_SIZE + 4);
    this.cursorLayer.addChild(this.cursorIcon);
    this.cursorLayer.addChild(this.cursorCount);

    this.tooltip.addChild(this.tooltipBg);
    this.tooltipText.position.set(6, 3);
    this.tooltip.addChild(this.tooltipText);

    this.container.addChild(this.tooltip);
    this.container.addChild(this.cursorLayer);
  }

  get isOpen(): boolean {
    return this.screen !== null;
  }

  get screenKind(): ContainerScreen['kind'] | null {
    return this.screen?.kind ?? null;
  }

  open(screen: ContainerScreen): void {
    if (this.screen) this.stashTransientItems();
    this.screen = screen;
    this.craftGrid = new ItemGrid(screen.kind === 'crafting_table' ? 9 : 4);
    this.hovered = null;
    this.container.visible = true;
    this.buildScreen();
    this.layout(this.viewportWidth, this.viewportHeight);
    this.update();
  }

  toggleInventory(): void {
    if (this.screen) this.close();
    else this.open({ kind: 'inventory' });
  }

  close(): void {
    if (!this.screen) return;
    this.stashTransientItems();
    this.screen = null;
    this.hovered = null;
    this.container.visible = false;
    this.callbacks.onChange?.();
  }

  layout(viewportWidth: number, viewportHeight: number): void {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    if (!this.screen) return;

    this.backdrop
      .clear()
      .rect(0, 0, viewportWidth, viewportHeight)
      .fill({ color: 0x000000, alpha: 0.45 });
    this.panel.position.set(
      Math.round((viewportWidth - PANEL_WIDTH) / 2),
      Math.round((viewportHeight - this.panelHeight) / 2),
    );
  }

  setPointer(x: number, y: number): void {
    this.cursorLayer.position.set(Math.round(x - ICON_SIZE / 2), Math.round(y - ICON_SIZE / 2));
    this.tooltip.position.set(Math.round(x + 14), Math.round(y - 24));
  }

  update(): void {
    if (!this.screen) return;
    for (const view of this.slotViews) {
      const hovered = this.hovered !== null && sameRef(this.hovered, view.ref);
      this.drawSlotFrame(view.frame, view.ref, hovered);
      this.drawStack(view.icon, view.count, this.stackAt(view.ref));
    }
    this.drawWidgets();
    this.drawCursor();
    this.drawTooltip();
  }

  // --- screen construction -------------------------------------------------

  private buildScreen(): void {
    for (const view of this.slotViews) view.root.destroy({ children: true });
    this.slotViews.length = 0;
    if (!this.screen) return;

    const screen = this.screen;
    this.title.text = titleFor(screen);
    this.title.position.set(MARGIN, MARGIN - 4);

    const topHeight = this.buildTopSection(screen);
    const mainY = MARGIN + TITLE_HEIGHT + topHeight + SECTION_GAP;

    // Main inventory (3x9) + hotbar row with a small visual gap.
    for (let row = 0; row < MAIN_INVENTORY_ROWS; row++) {
      for (let col = 0; col < INVENTORY_COLUMNS; col++) {
        this.createSlot(
          { area: 'inventory', index: HOTBAR_SIZE + row * INVENTORY_COLUMNS + col },
          MARGIN + col * (SLOT_SIZE + SLOT_GAP),
          mainY + row * (SLOT_SIZE + SLOT_GAP),
        );
      }
    }
    const hotbarY = mainY + MAIN_INVENTORY_ROWS * (SLOT_SIZE + SLOT_GAP) + 8;
    for (let col = 0; col < HOTBAR_SIZE; col++) {
      this.createSlot(
        { area: 'inventory', index: col },
        MARGIN + col * (SLOT_SIZE + SLOT_GAP),
        hotbarY,
      );
    }

    this.panelHeight = hotbarY + SLOT_SIZE + MARGIN;
    this.panelBg
      .clear()
      .rect(0, 0, PANEL_WIDTH, this.panelHeight)
      .fill(COLOR_PANEL)
      .stroke({ width: 4, color: COLOR_PANEL_BORDER })
      .rect(4, 4, PANEL_WIDTH - 8, this.panelHeight - 8)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
  }

  /** Build the screen-specific top area; returns its height. */
  private buildTopSection(screen: ContainerScreen): number {
    const top = MARGIN + TITLE_HEIGHT;

    if (screen.kind === 'inventory' || screen.kind === 'crafting_table') {
      const cols = screen.kind === 'inventory' ? 2 : 3;
      const rows = cols;
      const gridWidth = cols * SLOT_SIZE + (cols - 1) * SLOT_GAP;
      const gridX =
        screen.kind === 'inventory' ? MARGIN + 130 : Math.round((PANEL_WIDTH - gridWidth) / 2) - 50;
      for (let i = 0; i < cols * rows; i++) {
        this.createSlot(
          { area: 'craft', index: i },
          gridX + (i % cols) * (SLOT_SIZE + SLOT_GAP),
          top + Math.floor(i / cols) * (SLOT_SIZE + SLOT_GAP),
        );
      }
      const gridHeight = rows * SLOT_SIZE + (rows - 1) * SLOT_GAP;
      const resultY = top + Math.round(gridHeight / 2 - SLOT_SIZE / 2);
      this.createSlot({ area: 'result' }, gridX + gridWidth + 64, resultY);
      return gridHeight;
    }

    if (screen.kind === 'chest') {
      const rows = Math.ceil(screen.entity.slots.length / INVENTORY_COLUMNS);
      for (let i = 0; i < screen.entity.slots.length; i++) {
        this.createSlot(
          { area: 'chest', index: i },
          MARGIN + (i % INVENTORY_COLUMNS) * (SLOT_SIZE + SLOT_GAP),
          top + Math.floor(i / INVENTORY_COLUMNS) * (SLOT_SIZE + SLOT_GAP),
        );
      }
      return rows * SLOT_SIZE + (rows - 1) * SLOT_GAP;
    }

    // Furnace: input above fuel (flame between), arrow to the output.
    const colX = MARGIN + 110;
    this.createSlot({ area: 'furnace', slot: 'input' }, colX, top);
    this.createSlot({ area: 'furnace', slot: 'fuel' }, colX, top + SLOT_SIZE + 44);
    this.createSlot(
      { area: 'furnace', slot: 'output' },
      colX + SLOT_SIZE + 84,
      top + Math.round((SLOT_SIZE + 44) / 2),
    );
    return SLOT_SIZE * 2 + 44;
  }

  private createSlot(ref: SlotRef, x: number, y: number): void {
    const root = new Container();
    root.position.set(x, y);
    root.eventMode = 'static';
    root.cursor = 'pointer';
    root.on('pointerdown', (e: FederatedPointerEvent) => {
      const button = e.button === 2 ? 'right' : 'left';
      this.handleSlotClick(ref, button, e.shiftKey);
    });
    root.on('pointerover', () => {
      this.hovered = ref;
      this.update();
    });
    root.on('pointerout', () => {
      if (this.hovered && sameRef(this.hovered, ref)) this.hovered = null;
      this.update();
    });

    const frame = new Graphics();
    root.addChild(frame);

    const icon = new Sprite(Texture.EMPTY);
    icon.position.set((SLOT_SIZE - ICON_SIZE) / 2, (SLOT_SIZE - ICON_SIZE) / 2);
    icon.setSize(ICON_SIZE, ICON_SIZE);
    icon.visible = false;
    root.addChild(icon);

    const count = new Text({
      text: '',
      style: { fill: '#ffffff', fontFamily: 'monospace', fontSize: 13 },
    });
    count.anchor.set(1, 1);
    count.position.set(SLOT_SIZE - 3, SLOT_SIZE - 2);
    root.addChild(count);

    this.panel.addChild(root);
    this.slotViews.push({ root, frame, icon, count, ref });
  }

  // --- drawing --------------------------------------------------------------

  private drawSlotFrame(frame: Graphics, ref: SlotRef, hovered: boolean): void {
    const isResult = ref.area === 'result' || (ref.area === 'furnace' && ref.slot === 'output');
    frame
      .clear()
      .rect(0, 0, SLOT_SIZE, SLOT_SIZE)
      .fill(isResult ? COLOR_SLOT_RESULT : COLOR_SLOT)
      .stroke({ width: 2, color: COLOR_SLOT_BORDER_DARK })
      .rect(2, 2, SLOT_SIZE - 4, SLOT_SIZE - 4)
      .stroke({ width: 1, color: COLOR_SLOT_BORDER_LIGHT, alpha: 0.55 });
    if (hovered)
      frame.rect(2, 2, SLOT_SIZE - 4, SLOT_SIZE - 4).fill({ color: 0xffffff, alpha: 0.3 });
  }

  private drawStack(icon: Sprite, count: Text, stack: ItemStack | null): void {
    if (!stack) {
      icon.visible = false;
      count.text = '';
      return;
    }
    const textureKey = this.registry.byId(stack.blockId).textureKey;
    if (textureKey === null) {
      icon.visible = false;
    } else {
      icon.texture = this.atlas.texture(textureKey);
      icon.setSize(ICON_SIZE, ICON_SIZE);
      icon.visible = true;
    }
    count.text = stack.count > 1 ? String(stack.count) : '';
  }

  private drawWidgets(): void {
    this.widgets.clear();
    if (!this.screen) return;
    const top = MARGIN + TITLE_HEIGHT;

    if (this.screen.kind === 'inventory' || this.screen.kind === 'crafting_table') {
      const resultView = this.slotViews.find((v) => v.ref.area === 'result');
      if (resultView) {
        this.drawArrow(resultView.root.x - 48, resultView.root.y + SLOT_SIZE / 2, 36, 1);
      }
      return;
    }

    if (this.screen.kind === 'furnace') {
      const gauges = furnaceGauges(this.screen.entity);
      const colX = MARGIN + 110;
      const flameX = colX + SLOT_SIZE / 2;
      const flameTop = top + SLOT_SIZE + 8;

      // Flame gauge: fills bottom-up while fuel burns.
      this.widgets.rect(flameX - 10, flameTop, 20, 28).fill({ color: 0x000000, alpha: 0.15 });
      if (gauges.burn > 0) {
        const h = Math.max(2, Math.round(28 * gauges.burn));
        this.widgets.rect(flameX - 10, flameTop + (28 - h), 20, h).fill(0xe25822);
        this.widgets
          .rect(flameX - 5, flameTop + (28 - h) + Math.round(h * 0.4), 10, Math.ceil(h * 0.6))
          .fill(0xffa726);
      }

      // Cook-progress arrow to the output slot.
      const arrowY = top + Math.round((SLOT_SIZE + 44) / 2) + SLOT_SIZE / 2;
      this.drawArrow(colX + SLOT_SIZE + 16, arrowY, 56, gauges.cook);
    }
  }

  /** Grey arrow with an optional white progress fill (0..1). */
  private drawArrow(x: number, centerY: number, length: number, progress: number): void {
    const shaft = length - 12;
    this.widgets
      .rect(x, centerY - 4, shaft, 8)
      .fill(0x8b8b8b)
      .moveTo(x + shaft, centerY - 10)
      .lineTo(x + shaft + 12, centerY)
      .lineTo(x + shaft, centerY + 10)
      .closePath()
      .fill(0x8b8b8b);
    const filled = Math.max(0, Math.min(1, progress)) * shaft;
    if (filled > 0) this.widgets.rect(x, centerY - 4, filled, 8).fill(0xf5f5f5);
  }

  private drawCursor(): void {
    this.cursorLayer.visible = this.cursorStack !== null;
    if (this.cursorStack) this.drawStack(this.cursorIcon, this.cursorCount, this.cursorStack);
  }

  private drawTooltip(): void {
    const stack = this.hovered && !this.cursorStack ? this.stackAt(this.hovered) : null;
    if (!stack) {
      this.tooltip.visible = false;
      return;
    }
    this.tooltipText.text = this.registry.byId(stack.blockId).name;
    this.tooltipBg
      .clear()
      .rect(0, 0, this.tooltipText.width + 12, this.tooltipText.height + 8)
      .fill({ color: 0x100010, alpha: 0.92 })
      .stroke({ width: 1, color: 0x5000ff, alpha: 0.5 });
    this.tooltip.visible = true;
  }

  // --- slot data access ------------------------------------------------------

  private stackAt(ref: SlotRef): ItemStack | null {
    switch (ref.area) {
      case 'inventory':
        return this.inventory.slot(ref.index);
      case 'craft':
        return this.craftGrid.slot(ref.index);
      case 'result':
        return craftingResult(this.craftGrid.snapshot(), this.recipes);
      case 'chest':
        return this.chestEntity()?.slots[ref.index] ?? null;
      case 'furnace': {
        const furnace = this.furnaceEntity();
        return furnace ? furnace[ref.slot] : null;
      }
    }
  }

  private setStackAt(ref: SlotRef, stack: ItemStack | null): void {
    switch (ref.area) {
      case 'inventory':
        this.inventory.setSlot(ref.index, stack);
        return;
      case 'craft':
        this.craftGrid.setSlot(ref.index, stack);
        return;
      case 'chest': {
        const chest = this.chestEntity();
        if (chest) chest.slots[ref.index] = stack;
        return;
      }
      case 'furnace': {
        const furnace = this.furnaceEntity();
        if (furnace) furnace[ref.slot] = stack;
        return;
      }
      case 'result':
        return; // take-only
    }
  }

  private chestEntity(): ChestEntity | null {
    return this.screen?.kind === 'chest' ? this.screen.entity : null;
  }

  private furnaceEntity(): FurnaceEntity | null {
    return this.screen?.kind === 'furnace' ? this.screen.entity : null;
  }

  // --- interaction ------------------------------------------------------------

  private handleSlotClick(ref: SlotRef, button: 'left' | 'right', shift: boolean): void {
    if (ref.area === 'result') this.takeCraftingResult(shift);
    else if (isTakeOnly(ref)) this.takeOutputSlot(ref, shift);
    else if (shift && button === 'left') this.quickMove(ref);
    else if (button === 'right') this.rightClickSlot(ref);
    else this.leftClickSlot(ref);
    this.update();
    this.callbacks.onChange?.();
  }

  private leftClickSlot(ref: SlotRef): void {
    const next = mergeOrSwap(this.stackAt(ref), this.cursorStack);
    this.setStackAt(ref, next.target);
    this.cursorStack = next.cursor;
  }

  private rightClickSlot(ref: SlotRef): void {
    const target = this.stackAt(ref);

    if (!this.cursorStack) {
      // Take the larger half.
      if (!target) return;
      const taken = Math.ceil(target.count / 2);
      this.cursorStack = { blockId: target.blockId, count: taken };
      this.setStackAt(
        ref,
        target.count - taken > 0 ? { blockId: target.blockId, count: target.count - taken } : null,
      );
      return;
    }

    // Place exactly one item.
    if (!target) {
      this.setStackAt(ref, { blockId: this.cursorStack.blockId, count: 1 });
      this.cursorStack = this.shrink(this.cursorStack, 1);
      return;
    }
    if (target.blockId === this.cursorStack.blockId && target.count < MAX_STACK_SIZE) {
      this.setStackAt(ref, { blockId: target.blockId, count: target.count + 1 });
      this.cursorStack = this.shrink(this.cursorStack, 1);
    }
  }

  /** Shift-click: move the whole stack to this screen's counterpart area. */
  private quickMove(ref: SlotRef): void {
    const stack = this.stackAt(ref);
    if (!stack) return;

    if (ref.area !== 'inventory') {
      this.setStackAt(ref, this.addToInventory(stack));
      return;
    }

    const screen = this.screen;
    if (screen?.kind === 'chest') {
      this.setStackAt(ref, addToSlots(screen.entity.slots, stack));
      return;
    }
    if (screen?.kind === 'furnace') {
      const slot = this.registry.byId(stack.blockId).fuelSeconds !== undefined ? 'fuel' : 'input';
      const merged = mergeInto(screen.entity[slot], stack);
      screen.entity[slot] = merged.target;
      this.setStackAt(ref, merged.leftover);
      return;
    }
    // Inventory/crafting screens: swap between hotbar and main inventory.
    const toHotbar = ref.index >= HOTBAR_SIZE;
    const leftover = this.addToInventoryRange(
      stack,
      toHotbar ? 0 : HOTBAR_SIZE,
      toHotbar ? HOTBAR_SIZE : this.inventory.size,
    );
    this.setStackAt(ref, leftover);
  }

  private takeCraftingResult(shift: boolean): void {
    for (let guard = 0; guard < MAX_STACK_SIZE; guard++) {
      const recipe = findCraftingRecipe(this.craftGrid.snapshot(), this.recipes);
      if (!recipe) return;

      if (shift) {
        // Craft straight into the inventory until ingredients run out or full.
        if (this.inventory.add(recipe.result.blockId, recipe.result.count) > 0) return;
      } else {
        if (!canAcceptResult(this.cursorStack, recipe.result)) return;
        this.cursorStack = addToCursor(this.cursorStack, recipe.result);
      }
      consumeCraftingIngredients(this.craftGrid, recipe);
      if (!shift) return;
    }
  }

  private takeOutputSlot(ref: SlotRef, shift: boolean): void {
    const stack = this.stackAt(ref);
    if (!stack) return;
    if (shift) {
      this.setStackAt(ref, this.addToInventory(stack));
      return;
    }
    if (!this.cursorStack) {
      this.cursorStack = stack;
      this.setStackAt(ref, null);
    } else if (
      this.cursorStack.blockId === stack.blockId &&
      this.cursorStack.count + stack.count <= MAX_STACK_SIZE
    ) {
      this.cursorStack = { blockId: stack.blockId, count: this.cursorStack.count + stack.count };
      this.setStackAt(ref, null);
    }
  }

  /** Add to inventory; returns what did not fit (as a slot value). */
  private addToInventory(stack: ItemStack): ItemStack | null {
    const leftover = this.inventory.add(stack.blockId, stack.count);
    return leftover > 0 ? { blockId: stack.blockId, count: leftover } : null;
  }

  private addToInventoryRange(stack: ItemStack, start: number, end: number): ItemStack | null {
    let remaining = stack.count;
    for (let pass = 0; pass < 2 && remaining > 0; pass++) {
      for (let i = start; i < end && remaining > 0; i++) {
        const slot = this.inventory.slot(i);
        if (pass === 0 && slot && slot.blockId === stack.blockId && slot.count < MAX_STACK_SIZE) {
          const moved = Math.min(remaining, MAX_STACK_SIZE - slot.count);
          this.inventory.setSlot(i, { blockId: stack.blockId, count: slot.count + moved });
          remaining -= moved;
        } else if (pass === 1 && !slot) {
          const moved = Math.min(remaining, MAX_STACK_SIZE);
          this.inventory.setSlot(i, { blockId: stack.blockId, count: moved });
          remaining -= moved;
        }
      }
    }
    return remaining > 0 ? { blockId: stack.blockId, count: remaining } : null;
  }

  private shrink(stack: ItemStack, by: number): ItemStack | null {
    return stack.count > by ? { blockId: stack.blockId, count: stack.count - by } : null;
  }

  /** Return crafting-grid + cursor items to the inventory (drop overflow). */
  private stashTransientItems(): void {
    const stacks = this.craftGrid.drain();
    if (this.cursorStack) stacks.push(this.cursorStack);
    this.cursorStack = null;
    for (const stack of stacks) {
      const leftover = this.inventory.add(stack.blockId, stack.count);
      if (leftover > 0) {
        this.callbacks.onOverflow?.({ blockId: stack.blockId, count: leftover });
      }
    }
  }
}

function titleFor(screen: ContainerScreen): string {
  switch (screen.kind) {
    case 'inventory':
      return 'Inventory';
    case 'crafting_table':
      return 'Crafting';
    case 'chest':
      return 'Chest';
    case 'furnace':
      return 'Furnace';
  }
}

function isTakeOnly(ref: SlotRef): boolean {
  return ref.area === 'result' || (ref.area === 'furnace' && ref.slot === 'output');
}

function sameRef(a: SlotRef, b: SlotRef): boolean {
  if (a.area !== b.area) return false;
  if (a.area === 'furnace' && b.area === 'furnace') return a.slot === b.slot;
  if ('index' in a && 'index' in b) return a.index === b.index;
  return true; // result
}

function mergeOrSwap(
  target: ItemStack | null,
  cursor: ItemStack | null,
): { target: ItemStack | null; cursor: ItemStack | null } {
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

/** Merge a stack into a single slot; returns the new slot + leftover. */
function mergeInto(
  target: ItemStack | null,
  stack: ItemStack,
): { target: ItemStack; leftover: ItemStack | null } {
  if (target && target.blockId !== stack.blockId) return { target, leftover: stack };
  const have = target?.count ?? 0;
  const moved = Math.min(stack.count, MAX_STACK_SIZE - have);
  if (moved <= 0) return { target: target ?? stack, leftover: stack };
  return {
    target: { blockId: stack.blockId, count: have + moved },
    leftover:
      stack.count - moved > 0 ? { blockId: stack.blockId, count: stack.count - moved } : null,
  };
}

/** Add a stack to a raw slot array (chest). Returns the leftover. */
function addToSlots(slots: Array<ItemStack | null>, stack: ItemStack): ItemStack | null {
  let remaining = stack.count;
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    const slot = slots[i];
    if (!slot || slot.blockId !== stack.blockId || slot.count >= MAX_STACK_SIZE) continue;
    const moved = Math.min(remaining, MAX_STACK_SIZE - slot.count);
    slots[i] = { blockId: stack.blockId, count: slot.count + moved };
    remaining -= moved;
  }
  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (slots[i]) continue;
    const moved = Math.min(remaining, MAX_STACK_SIZE);
    slots[i] = { blockId: stack.blockId, count: moved };
    remaining -= moved;
  }
  return remaining > 0 ? { blockId: stack.blockId, count: remaining } : null;
}

function canAcceptResult(cursor: ItemStack | null, result: ItemStack): boolean {
  if (!cursor) return true;
  return cursor.blockId === result.blockId && cursor.count + result.count <= MAX_STACK_SIZE;
}

function addToCursor(cursor: ItemStack | null, result: ItemStack): ItemStack {
  if (!cursor) return { ...result };
  return { blockId: cursor.blockId, count: cursor.count + result.count };
}
