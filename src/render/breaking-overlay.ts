import { Graphics } from 'pixi.js';
import type { MiningState } from '@/world/mining';
import { miningStage } from '@/world/mining';

const CRACK_LINES: ReadonlyArray<readonly [number, number, number, number]> = [
  [0.5, 0.12, 0.42, 0.32],
  [0.42, 0.32, 0.24, 0.22],
  [0.42, 0.32, 0.56, 0.48],
  [0.56, 0.48, 0.78, 0.36],
  [0.56, 0.48, 0.5, 0.7],
  [0.5, 0.7, 0.28, 0.78],
  [0.5, 0.7, 0.68, 0.88],
  [0.24, 0.22, 0.12, 0.42],
  [0.78, 0.36, 0.9, 0.58],
  [0.28, 0.78, 0.14, 0.92],
];

export function drawBreakingOverlay(graphics: Graphics, state: MiningState | null): void {
  graphics.clear();
  if (!state) {
    graphics.visible = false;
    return;
  }

  const stage = miningStage(state.progress, CRACK_LINES.length);
  graphics.visible = true;
  graphics.position.set(state.target.bx, state.target.by);
  graphics.rect(0, 0, 1, 1).fill({ color: 0xffffff, alpha: 0.08 + stage * 0.012 });

  for (let i = 0; i <= stage; i++) {
    const line = CRACK_LINES[i];
    if (!line) continue;
    graphics
      .moveTo(line[0], line[1])
      .lineTo(line[2], line[3])
      .stroke({ width: 0.045, color: 0x111111, alpha: 0.9 });
    graphics
      .moveTo(line[0], line[1] + 0.018)
      .lineTo(line[2], line[3] + 0.018)
      .stroke({ width: 0.018, color: 0xffffff, alpha: 0.65 });
  }
}
