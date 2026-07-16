export type ColorMode = "light" | "dark";

export type BrushColors = Record<ColorMode, string>;

export type BrushSettings = {
  colors: BrushColors;
  size: number;
  opacity: number;
};

export type ViewState = {
  x: number;
  y: number;
  scale: number;
};

export type CanvasTheme = {
  mode: ColorMode;
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

type Stroke = {
  points: PointerPoint[];
  brush: BrushSettings;
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
  private hasInitializedView = false;
  private strokes: Stroke[] = [];
  private activeStroke: Stroke | null = null;
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
    this.brush = cloneBrush(brush);
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
    this.annotationCanvas.addEventListener("pointerdown", this.handlePointerDown);
    this.annotationCanvas.addEventListener("pointermove", this.handlePointerMove);
    this.annotationCanvas.addEventListener("pointerup", this.handlePointerUp);
    this.annotationCanvas.addEventListener("pointercancel", this.handlePointerUp);
    this.annotationCanvas.addEventListener("lostpointercapture", this.handlePointerUp);

    this.configureCanvases();
    this.resetView();
  }

  updateBrush(brush: BrushSettings): void {
    this.brush = cloneBrush(brush);
  }

  updateTheme(theme: CanvasTheme): void {
    this.theme = theme;
    this.paintBackground();
    this.renderAnnotations();
  }

  newCanvas(size: CanvasSize): void {
    this.clearAnnotations();
    this.boardSize = normalizeCanvasSize(size);
    this.configureCanvases();
    this.resetView();
  }

  clearAnnotations(): void {
    this.strokes = [];
    this.activeStroke = null;
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
    this.annotationCanvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.annotationCanvas.removeEventListener("pointermove", this.handlePointerMove);
    this.annotationCanvas.removeEventListener("pointerup", this.handlePointerUp);
    this.annotationCanvas.removeEventListener("pointercancel", this.handlePointerUp);
    this.annotationCanvas.removeEventListener("lostpointercapture", this.handlePointerUp);
  }

  private handleViewportResize(): void {
    this.configureCanvases();

    if (!this.hasInitializedView) {
      this.resetView();
      return;
    }

    this.applyView();
  }

  private configureCanvases(): void {
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

    this.pixelRatio = nextPixelRatio;
    this.board.style.width = `${this.boardSize.width}px`;
    this.board.style.height = `${this.boardSize.height}px`;
    this.resizeCanvas(this.backgroundCanvas, this.boardSize.width, this.boardSize.height);
    this.resizeCanvas(this.annotationCanvas, this.boardSize.width, this.boardSize.height);
    this.paintBackground();
    this.renderAnnotations();
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

    this.annotationCanvas.setPointerCapture(event.pointerId);
    const point = this.getPoint(event);

    this.activeStroke = {
      points: [point],
      brush: cloneBrush(this.brush),
    };
    this.strokes.push(this.activeStroke);
    this.drawDot(point, this.activeStroke.brush);
    event.preventDefault();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.activeStroke) {
      return;
    }

    const coalescedEvents =
      typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    const points = coalescedEvents.map((coalescedEvent) => this.getPoint(coalescedEvent));

    if (points.length === 0) {
      points.push(this.getPoint(event));
    }

    for (const point of points) {
      const previousPoint = this.activeStroke.points.at(-1);

      if (!previousPoint) {
        continue;
      }

      this.activeStroke.points.push(point);
      this.drawLine(previousPoint, point, this.activeStroke.brush);
    }

    event.preventDefault();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.activeStroke) {
      return;
    }

    this.activeStroke = null;

    if (this.annotationCanvas.hasPointerCapture(event.pointerId)) {
      this.annotationCanvas.releasePointerCapture(event.pointerId);
    }
  };

  private getPoint(event: PointerEvent): PointerPoint {
    const rect = this.annotationCanvas.getBoundingClientRect();
    const pressure = event.pressure > 0 ? event.pressure : 0.5;

    return {
      x: ((event.clientX - rect.left) / rect.width) * this.boardSize.width,
      y: ((event.clientY - rect.top) / rect.height) * this.boardSize.height,
      pressure,
    };
  }

  private handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const { x: deltaX, y: deltaY } = this.normalizeWheelDelta(event);

    if (event.ctrlKey) {
      this.zoomAt(event.clientX, event.clientY, Math.exp(-deltaY * 0.01));
      return;
    }

    if (event.altKey) {
      const steps =
        Math.sign(deltaY) * Math.max(1, Math.round(Math.abs(deltaY) / 80));

      this.callbacks.onBrushSizeChange?.(-steps);
      return;
    }

    this.view = {
      ...this.view,
      x: this.view.x - deltaX,
      y: this.view.y - deltaY,
    };
    this.applyView();
  };

  private normalizeWheelDelta(event: WheelEvent): { x: number; y: number } {
    let xMultiplier = 1;
    let yMultiplier = 1;

    if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
      xMultiplier = 16;
      yMultiplier = 16;
    } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
      xMultiplier = this.viewport.clientWidth;
      yMultiplier = this.viewport.clientHeight;
    }

    if (event.shiftKey && event.deltaX === 0 && !event.ctrlKey && !event.altKey) {
      return { x: event.deltaY * xMultiplier, y: 0 };
    }

    return {
      x: event.deltaX * xMultiplier,
      y: event.deltaY * yMultiplier,
    };
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

  private renderAnnotations(): void {
    this.annotationContext.clearRect(
      0,
      0,
      this.annotationCanvas.width,
      this.annotationCanvas.height,
    );

    this.strokes.forEach((stroke) => this.renderStroke(stroke));
  }

  private renderStroke(stroke: Stroke): void {
    const firstPoint = stroke.points[0];

    if (!firstPoint) {
      return;
    }

    this.drawDot(firstPoint, stroke.brush);

    for (let index = 1; index < stroke.points.length; index += 1) {
      this.drawLine(stroke.points[index - 1], stroke.points[index], stroke.brush);
    }
  }

  private drawDot(point: PointerPoint, brush: BrushSettings): void {
    const radius = this.getStrokeWidth(point.pressure, brush) / 2;

    this.annotationContext.save();
    this.annotationContext.globalAlpha = brush.opacity;
    this.annotationContext.fillStyle = brush.colors[this.theme.mode];
    this.annotationContext.beginPath();
    this.annotationContext.arc(
      point.x * this.pixelRatio,
      point.y * this.pixelRatio,
      radius,
      0,
      Math.PI * 2,
    );
    this.annotationContext.fill();
    this.annotationContext.restore();
  }

  private drawLine(
    from: PointerPoint,
    to: PointerPoint,
    brush: BrushSettings,
  ): void {
    this.annotationContext.save();
    this.annotationContext.globalAlpha = brush.opacity;
    this.annotationContext.strokeStyle = brush.colors[this.theme.mode];
    this.annotationContext.lineWidth = this.getStrokeWidth(
      (from.pressure + to.pressure) / 2,
      brush,
    );
    this.annotationContext.lineCap = "round";
    this.annotationContext.lineJoin = "round";
    this.annotationContext.beginPath();
    this.annotationContext.moveTo(from.x * this.pixelRatio, from.y * this.pixelRatio);
    this.annotationContext.lineTo(to.x * this.pixelRatio, to.y * this.pixelRatio);
    this.annotationContext.stroke();
    this.annotationContext.restore();
  }

  private getStrokeWidth(pressure: number, brush: BrushSettings): number {
    const pressureScale = 0.65 + pressure * 0.7;
    return brush.size * this.pixelRatio * pressureScale;
  }
}

type PointerPoint = {
  x: number;
  y: number;
  pressure: number;
};

const cloneBrush = (brush: BrushSettings): BrushSettings => ({
  colors: { ...brush.colors },
  size: brush.size,
  opacity: brush.opacity,
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const normalizeCanvasSize = (size: CanvasSize): CanvasSize => ({
  width: Math.round(clamp(size.width, MIN_BOARD_SIZE, MAX_BOARD_SIZE)),
  height: Math.round(clamp(size.height, MIN_BOARD_SIZE, MAX_BOARD_SIZE)),
});
