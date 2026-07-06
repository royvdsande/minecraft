import type { BlockId, ItemStack } from '@/blocks/block';
import { GRAVITY, MAX_FALL_SPEED, moveX, moveY, type SolidQuery } from './physics';

/**
 * Ground item drops: broken blocks and Q-dropped stacks become small physical
 * entities that fall, slide to a stop and get picked up when the player comes
 * close. Pure logic — rendering lives in render/item-drop-view.ts.
 */

/** Hitbox edge length in block units (anchor = feet-center, like entities). */
export const DROP_SIZE = 0.3;
/** Distance (body centers) within which the player vacuums up a drop. */
export const PICKUP_RADIUS = 1.4;
/** Seconds before a freshly spawned drop may be picked up. */
export const PICKUP_DELAY = 0.4;
/** Seconds before a Q-thrown drop may be picked up (so it actually leaves). */
export const THROW_PICKUP_DELAY = 1.2;
/** Drops vanish after this many seconds, like Minecraft. */
export const DESPAWN_SECONDS = 300;

const DROP_FRICTION = 8; // horizontal damping per second when grounded
const MAX_STEP = 0.25;

export interface ItemDrop {
  readonly id: number;
  readonly blockId: BlockId;
  readonly count: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly age: number;
  readonly pickupDelay: number;
}

/** Advance one drop by dt seconds against the tilemap. */
export function stepDrop(drop: ItemDrop, dt: number, isSolid: SolidQuery): ItemDrop {
  let vx = drop.vx;
  let vy = Math.min(drop.vy + GRAVITY * dt, MAX_FALL_SPEED);

  let dx = vx * dt;
  let dy = vy * dt;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_STEP));
  dx /= steps;
  dy /= steps;

  let minX = drop.x - DROP_SIZE / 2;
  let minY = drop.y - DROP_SIZE;
  let grounded = false;

  for (let i = 0; i < steps; i++) {
    const rx = moveX(minX, minY, DROP_SIZE, DROP_SIZE, dx, isSolid);
    minX = rx.x;
    if (rx.hit) {
      vx = 0;
      dx = 0;
    }
    const ry = moveY(minX, minY, DROP_SIZE, DROP_SIZE, dy, isSolid);
    minY = ry.y;
    if (ry.hit) {
      if (dy > 0) grounded = true;
      vy = 0;
      dy = 0;
    }
  }

  if (grounded) {
    const damping = Math.max(0, 1 - DROP_FRICTION * dt);
    vx *= damping;
    if (Math.abs(vx) < 0.01) vx = 0;
  }

  return {
    ...drop,
    x: minX + DROP_SIZE / 2,
    y: minY + DROP_SIZE,
    vx,
    vy,
    age: drop.age + dt,
  };
}

export interface SpawnOptions {
  readonly vx?: number;
  readonly vy?: number;
  readonly pickupDelay?: number;
}

/**
 * Owner of all live drops. `step` integrates physics and despawning; pickups
 * are collected by the caller via `collect`.
 */
export class ItemDropManager {
  private items: ItemDrop[] = [];
  private nextId = 1;

  get drops(): readonly ItemDrop[] {
    return this.items;
  }

  spawn(stack: ItemStack, x: number, y: number, options: SpawnOptions = {}): ItemDrop {
    const drop: ItemDrop = {
      id: this.nextId++,
      blockId: stack.blockId,
      count: stack.count,
      x,
      y,
      vx: options.vx ?? (Math.random() - 0.5) * 2,
      vy: options.vy ?? -3,
      age: 0,
      pickupDelay: options.pickupDelay ?? PICKUP_DELAY,
    };
    this.items.push(drop);
    return drop;
  }

  step(dt: number, isSolid: SolidQuery): void {
    this.items = this.items
      .map((drop) => stepDrop(drop, dt, isSolid))
      .filter((drop) => drop.age < DESPAWN_SECONDS);
  }

  /**
   * Try to move drops near the player's body center into the inventory.
   * `tryAdd` returns the leftover count that did not fit. Returns the stacks
   * that were (partly) picked up, for HUD/sound hooks.
   */
  collect(
    centerX: number,
    centerY: number,
    tryAdd: (blockId: BlockId, count: number) => number,
  ): ItemStack[] {
    const collected: ItemStack[] = [];
    const remaining: ItemDrop[] = [];
    for (const drop of this.items) {
      const dx = drop.x - centerX;
      const dy = drop.y - DROP_SIZE / 2 - centerY;
      const inRange =
        drop.age >= drop.pickupDelay && dx * dx + dy * dy <= PICKUP_RADIUS * PICKUP_RADIUS;
      if (!inRange) {
        remaining.push(drop);
        continue;
      }

      const leftover = tryAdd(drop.blockId, drop.count);
      const taken = drop.count - leftover;
      if (taken > 0) collected.push({ blockId: drop.blockId, count: taken });
      if (leftover > 0)
        remaining.push(leftover === drop.count ? drop : { ...drop, count: leftover });
    }
    this.items = remaining;
    return collected;
  }

  /** Restore state (save/load). */
  load(drops: readonly ItemDrop[]): void {
    this.items = [...drops];
    this.nextId = Math.max(0, ...drops.map((d) => d.id)) + 1;
  }
}
