import { CHUNK_WIDTH, chunkXOf, localXOf } from '@/core/constants';
import { planChunkStreaming, type ChunkStreamPlan } from '@/world/chunk-stream';
import { ChunkView } from './chunk-view';
import type { Container } from 'pixi.js';
import type { BlockRegistry } from '@/blocks/registry';
import type { World } from '@/world/world';
import type { BlockAtlas } from './texture-atlas';

/** Render-side owner for streamed chunk views. World chunk data stays cached. */
export class ChunkStreamer {
  private readonly views = new Map<number, ChunkView>();

  constructor(
    private readonly layer: Container,
    private readonly world: World,
    private readonly registry: BlockRegistry,
    private readonly atlas: BlockAtlas,
  ) {}

  /** Ensure chunk views match the desired radius around a world-X position. */
  syncAround(worldX: number, radius: number): ChunkStreamPlan {
    const plan = planChunkStreaming(this.views.keys(), worldX, radius);

    for (const chunkX of plan.toUnload) {
      const view = this.views.get(chunkX);
      if (!view) continue;
      this.layer.removeChild(view.container);
      view.destroy();
      this.views.delete(chunkX);
    }

    for (const chunkX of plan.toLoad) {
      const view = new ChunkView(this.world.getChunk(chunkX), this.registry, this.atlas);
      this.views.set(chunkX, view);
      this.layer.addChild(view.container);
    }

    return plan;
  }

  /** Push a changed world cell to its on-screen chunk view, if rendered. */
  updateBlock(bx: number, by: number): void {
    this.views.get(chunkXOf(bx))?.update(localXOf(bx), by);
  }

  renderedChunkXs(): number[] {
    return [...this.views.keys()].sort((a, b) => a - b);
  }

  destroy(): void {
    for (const view of this.views.values()) {
      this.layer.removeChild(view.container);
      view.destroy();
    }
    this.views.clear();
  }
}

/** Radius that covers the current viewport plus a preload margin. */
export function streamRadiusForViewport(
  viewportWidth: number,
  pixelsPerBlock: number,
  minRadius: number,
  marginChunks: number,
): number {
  if (viewportWidth < 0 || pixelsPerBlock <= 0) {
    throw new RangeError('Viewport width must be non-negative and pixelsPerBlock must be positive');
  }

  const halfVisibleBlocks = viewportWidth / (2 * pixelsPerBlock);
  const visibleRadius = Math.ceil(halfVisibleBlocks / CHUNK_WIDTH);
  return Math.max(minRadius, visibleRadius + marginChunks);
}
