/**
 * Mouse input over the game canvas. Tracks the pointer position (in canvas CSS
 * pixels, ready for Camera.screenToWorld) and exposes click edges the
 * simulation consumes once per press, plus accumulated wheel steps for cycling
 * the selected block.
 */
export class Mouse {
  /** Pointer position in canvas CSS pixels. */
  x = 0;
  y = 0;
  /** False until the pointer has been over the canvas at least once. */
  hasPosition = false;

  leftDown = false;
  rightDown = false;

  private leftEdge = false;
  private rightEdge = false;
  private wheelSteps = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly win: Window = window,
  ) {
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerdown', this.onDown);
    this.win.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private onMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.x = e.clientX - rect.left;
    this.y = e.clientY - rect.top;
    this.hasPosition = true;
  };

  private onDown = (e: PointerEvent): void => {
    this.onMove(e);
    if (e.button === 0) {
      this.leftDown = true;
      this.leftEdge = true;
    } else if (e.button === 2) {
      this.rightDown = true;
      this.rightEdge = true;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.button === 0) this.leftDown = false;
    else if (e.button === 2) this.rightDown = false;
  };

  private onContextMenu = (e: Event): void => {
    e.preventDefault(); // let right-click place blocks instead of opening a menu
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.wheelSteps += Math.sign(e.deltaY);
  };

  /** True once per left-button press. */
  takeLeftClick(): boolean {
    const edge = this.leftEdge;
    this.leftEdge = false;
    return edge;
  }

  /** True once per right-button press. */
  takeRightClick(): boolean {
    const edge = this.rightEdge;
    this.rightEdge = false;
    return edge;
  }

  /** Net wheel steps since the last call (positive = wheel down). */
  takeWheelSteps(): number {
    const steps = this.wheelSteps;
    this.wheelSteps = 0;
    return steps;
  }

  dispose(): void {
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.win.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }
}
