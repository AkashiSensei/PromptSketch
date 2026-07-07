export type BrushSettings = {
  color: string;
  size: number;
  opacity: number;
};

export type ViewState = {
  x: number;
  y: number;
  scale: number;
};

export type CanvasTheme = {
  background: string;
  grid: string;
};

export type CanvasSize = {
  width: number;
  height: number;
};

type CanvasCallbacks = {
  onBrushSizeChange?: (steps: number) => void;
  onViewChange?: (view: ViewState) => void;
};

type CanvasElements = {
  viewport: HTMLElement;
  board: HTMLElement;
  background: HTMLCanvasElement;
  annotation: HTMLCanvasElement;
};

const DEFAULT_BOARD_SIZE: CanvasSize = {
  width: 1600,
  height: 1000,
};
const MIN_BOARD_SIZE = 320;
const MAX_BOARD_SIZE = 4096;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export class PromptCanvas {
  private readonly viewport: HTMLElement;
  private readonly board: HTMLElement;
  private readonly backgroundCanvas: HTMLCanvasElement;
  private readonly annotationCanvas: HTMLCanvasElement;
  private readonly backgroundContext: CanvasRenderingContext2D;
  private readonly annotationContext: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private readonly callbacks: CanvasCallbacks;
  private brush: BrushSettings;
  private theme: CanvasTheme;
  private boardSize: CanvasSize = { ...DEFAULT_BOARD_SIZE };
  private drawing = false;
  private hasInitializedView = false;
  private lastPoint: PointerPoint | null = null;
  private pixelRatio = 1;
  private view: ViewState = {
    x: 0,
    y: 0,
    scale: 1,
  };

  constructor(
    elements: CanvasElements,
    brush: BrushSettings,
    theme: CanvasTheme,
    callbacks: CanvasCallbacks = {},
  ) {
    this.viewport = elements.viewport;
    this.board = elements.board;
    this.backgroundCanvas = elements.background;
    this.annotationCanvas = elements.annotation;
    this.callbacks = callbacks;
    this.brush = brush;
    this.theme = theme;

    const backgroundContext = this.backgroundCanvas.getContext("2d");
    const annotationContext = this.annotationCanvas.getContext("2d");

    if (!backgroundContext || !annotationContext) {
      throw new Error("Canvas rendering is not supported in this browser.");
    }

    this.backgroundContext = backgroundContext;
    this.annotationContext = annotationContext;

    this.resizeObserver = new ResizeObserver(() => this.handleViewportResize());
    this.resizeObserver.observe(this.viewport);

    this.viewport.addEventListener("wheel", this.handleWheel, { passive: false });
    this.viewport.addEventListener("dblclick", this.handleDoubleClick);
    this.annotationCanvas.addEventListener("pointerdown", this.handlePointerDown);
    this.annotationCanvas.addEventListener("pointermove", this.handlePointerMove);
    this.annotationCanvas.addEventListener("pointerup", this.handlePointerUp);
    this.annotationCanvas.addEventListener("pointercancel", this.handlePointerUp);
    this.annotationCanvas.addEventListener("lostpointercapture", this.handlePointerUp);

    this.configureCanvases();
    this.resetView();
  }

  updateBrush(brush: BrushSettings): void {
    this.brush = brush;
  }

  updateTheme(theme: CanvasTheme): void {
    this.theme = theme;
    this.paintBackground();
  }

  newCanvas(size: CanvasSize): void {
    this.boardSize = normalizeCanvasSize(size);
    this.configureCanvases({ preserveAnnotations: false });
    this.resetView();
  }

  clearAnnotations(): void {
    this.annotationContext.clearRect(
      0,
      0,
      this.annotationCanvas.width,
      this.annotationCanvas.height,
    );
  }

  resetView(): void {
    const rect = this.viewport.getBoundingClientRect();
    const padding = rect.width < 680 ? 24 : 56;
    const scale = clamp(
      Math.min(
        (rect.width - padding) / this.boardSize.width,
        (rect.height - padding) / this.boardSize.height,
      ),
      MIN_SCALE,
      1,
    );

    this.view = {
      x: (rect.width - this.boardSize.width * scale) / 2,
      y: (rect.height - this.boardSize.height * scale) / 2,
      scale,
    };
    this.hasInitializedView = true;
    this.applyView();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.viewport.removeEventListener("wheel", this.handleWheel);
    this.viewport.removeEventListener("dblclick", this.handleDoubleClick);
    this.annotationCanvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.annotationCanvas.removeEventListener("pointermove", this.handlePointerMove);
    this.annotationCanvas.removeEventListener("pointerup", this.handlePointerUp);
    this.annotationCanvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.annotationCanvas.removeEventListener("lostpointercapture", this.handlePointerUp);
  }

  private handleViewportResize(): void {
    this.configureCanvases({ preserveAnnotations: true });

    if (!this.hasInitializedView) {
      this.resetView();
      return;
    }

    this.applyView();
  }

  private configureCanvases(options: { preserveAnnotations: boolean } = {
    preserveAnnotations: true,
  }): void {
    const nextPixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const nextWidth = Math.floor(this.boardSize.width * nextPixelRatio);
    const nextHeight = Math.floor(this.boardSize.height * nextPixelRatio);

    if (
      this.pixelRatio === nextPixelRatio &&
      this.annotationCanvas.width === nextWidth &&
      this.annotationCanvas.height === nextHeight
    ) {
      return;
    }

    const snapshot = document.createElement("canvas");
    snapshot.width = this.annotationCanvas.width;
    snapshot.height = this.annotationCanvas.height;

    const snapshotContext = snapshot.getContext("2d");
    if (
      options.preserveAnnotations &&
      snapshotContext &&
      this.annotationCanvas.width > 0 &&
      this.annotationCanvas.height > 0
    ) {
      snapshotContext.drawImage(this.annotationCanvas, 0, 0);
    }

    this.pixelRatio = nextPixelRatio;
    this.board.style.width = `${this.boardSize.width}px`;
    this.board.style.height = `${this.boardSize.height}px`;
    this.resizeCanvas(this.backgroundCanvas, this.boardSize.width, this.boardSize.height);
    this.resizeCanvas(this.annotationCanvas, this.boardSize.width, this.boardSize.height);
    this.paintBackground();

    if (
      options.preserveAnnotations &&
      snapshotContext &&
      snapshot.width > 0 &&
      snapshot.height > 0
    ) {
      this.annotationContext.drawImage(
        snapshot,
        0,
        0,
        snapshot.width,
        snapshot.height,
        0,
        0,
        this.annotationCanvas.width,
        this.annotationCanvas.height,
      );
    }
  }

  private resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
    canvas.width = Math.floor(width * this.pixelRatio);
    canvas.height = Math.floor(height * this.pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }

  private paintBackground(): void {
    const { width, height } = this.backgroundCanvas;

    this.backgroundContext.clearRect(0, 0, width, height);
    this.backgroundContext.fillStyle = this.theme.background;
    this.backgroundContext.fillRect(0, 0, width, height);

    const gridStep = 24 * this.pixelRatio;
    this.backgroundContext.strokeStyle = this.theme.grid;
    this.backgroundContext.lineWidth = 1;
    this.backgroundContext.beginPath();

    for (let x = 0; x <= width; x += gridStep) {
      this.backgroundContext.moveTo(x + 0.5, 0);
      this.backgroundContext.lineTo(x + 0.5, height);
    }

    for (let y = 0; y <= height; y += gridStep) {
      this.backgroundContext.moveTo(0, y + 0.5);
      this.backgroundContext.lineTo(width, y + 0.5);
    }

    this.backgroundContext.stroke();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    this.drawing = true;
    this.annotationCanvas.setPointerCapture(event.pointerId);
    this.lastPoint = this.getPoint(event);
    this.drawDot(this.lastPoint);
    event.preventDefault();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.drawing || !this.lastPoint) {
      return;
    }

    const coalescedEvents =
      typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    const points = coalescedEvents.map((coalescedEvent) => this.getPoint(coalescedEvent));

    if (points.length === 0) {
      points.push(this.getPoint(event));
    }

    for (const point of points) {
      this.drawLine(this.lastPoint, point);
      this.lastPoint = point;
    }

    event.preventDefault();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.drawing) {
      return;
    }

    this.drawing = false;
    this.lastPoint = null;

    if (this.annotationCanvas.hasPointerCapture(event.pointerId)) {
      this.annotationCanvas.releasePointerCapture(event.pointerId);
    }
  };

  private getPoint(event: PointerEvent): PointerPoint {
    const rect = this.annotationCanvas.getBoundingClientRect();
    const pressure = event.pressure > 0 ? event.pressure : 0.5;

    return {
      x: ((event.clientX - rect.left) / rect.width) * this.annotationCanvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.annotationCanvas.height,
      pressure,
    };
  }

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const delta = this.normalizeWheelDelta(event);
    const steps = Math.sign(delta) * Math.max(1, Math.round(Math.abs(delta) / 80));

    this.callbacks.onBrushSizeChange?.(-steps);
  };

  private handleDoubleClick = (event: MouseEvent): void => {
    if (event.button !== 0) {
      return;
    }

    this.zoomAt(event.clientX, event.clientY, 1.25);
  };

  private normalizeWheelDelta(event: WheelEvent): number {
    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      return event.deltaY * 16;
    }

    if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      return event.deltaY * this.viewport.clientHeight;
    }

    return event.deltaY;
  }

  private zoomAt(clientX: number, clientY: number, factor: number): void {
    const viewportRect = this.viewport.getBoundingClientRect();
    const pointX = clientX - viewportRect.left;
    const pointY = clientY - viewportRect.top;
    const worldX = (pointX - this.view.x) / this.view.scale;
    const worldY = (pointY - this.view.y) / this.view.scale;
    const nextScale = clamp(this.view.scale * factor, MIN_SCALE, MAX_SCALE);

    this.view = {
      x: pointX - worldX * nextScale,
      y: pointY - worldY * nextScale,
      scale: nextScale,
    };
    this.applyView();
  }

  private applyView(): void {
    this.board.style.transform = `translate3d(${this.view.x}px, ${this.view.y}px, 0) scale(${this.view.scale})`;
    this.callbacks.onViewChange?.({ ...this.view });
  }

  private drawDot(point: PointerPoint): void {
    const radius = this.getStrokeWidth(point.pressure) / 2;

    this.annotationContext.save();
    this.annotationContext.globalAlpha = this.brush.opacity;
    this.annotationContext.fillStyle = this.brush.color;
    this.annotationContext.beginPath();
    this.annotationContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
    this.annotationContext.fill();
    this.annotationContext.restore();
  }

  private drawLine(from: PointerPoint, to: PointerPoint): void {
    this.annotationContext.save();
    this.annotationContext.globalAlpha = this.brush.opacity;
    this.annotationContext.strokeStyle = this.brush.color;
    this.annotationContext.lineWidth = this.getStrokeWidth((from.pressure + to.pressure) / 2);
    this.annotationContext.lineCap = "round";
    this.annotationContext.lineJoin = "round";
    this.annotationContext.beginPath();
    this.annotationContext.moveTo(from.x, from.y);
    this.annotationContext.lineTo(to.x, to.y);
    this.annotationContext.stroke();
    this.annotationContext.restore();
  }

  private getStrokeWidth(pressure: number): number {
    const pressureScale = 0.65 + pressure * 0.7;
    return this.brush.size * this.pixelRatio * pressureScale;
  }
}

type PointerPoint = {
  x: number;
  y: number;
  pressure: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const normalizeCanvasSize = (size: CanvasSize): CanvasSize => ({
  width: Math.round(clamp(size.width, MIN_BOARD_SIZE, MAX_BOARD_SIZE)),
  height: Math.round(clamp(size.height, MIN_BOARD_SIZE, MAX_BOARD_SIZE)),
});
