import type { ThemeColorPair, ThemeMode } from "./colors";
import {
  distanceSquaredBetweenSegments,
  getRoundedRectRadius,
  getShapeBounds,
  shapeIntersectsSweptCircle,
  type ShapeBounds,
  type ShapeKind,
} from "./geometry";

export type { ShapeKind } from "./geometry";

export type CanvasTool = "brush" | "shape" | "stroke-eraser";

export type BrushSettings = {
  color: ThemeColorPair;
  size: number;
  opacity: number;
};

export type ShapeSettings = {
  kind: ShapeKind;
  color: ThemeColorPair;
  style: "outline" | "fill";
  strokeWidth: number;
};

export type ViewState = {
  x: number;
  y: number;
  scale: number;
};

export type CanvasTheme = {
  mode: ThemeMode;
  background: string;
  grid: string;
};

export type CanvasSize = {
  width: number;
  height: number;
};

type CanvasCallbacks = {
  onToolSizeChange?: (steps: number) => void;
  onViewChange?: (view: ViewState) => void;
};

type CanvasElements = {
  viewport: HTMLElement;
  board: HTMLElement;
  background: HTMLCanvasElement;
  annotation: HTMLCanvasElement;
  eraserCursor: HTMLElement;
};

type BaseImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
};

type Stroke = {
  type: "stroke";
  points: PointerPoint[];
  brush: BrushSettings;
};

type ShapeAnnotation = {
  type: "shape";
  bounds: ShapeBounds;
  settings: ShapeSettings;
};

type Annotation = Stroke | ShapeAnnotation;

type ActiveShape = {
  start: PointerPoint;
  end: PointerPoint;
  constrainAspectRatio: boolean;
  settings: ShapeSettings;
};

const DEFAULT_BOARD_SIZE: CanvasSize = {
  width: 1600,
  height: 1000,
};
const MIN_BOARD_SIZE = 320;
const MAX_BOARD_SIZE = 4096;
const MIN_SCALE = 0.25;
const MAX_SCALE = 4;
const MIN_SHAPE_SIZE = 1;
const DEFAULT_ROUNDED_RECT_RADIUS = 20;

export class PromptCanvas {
  private readonly viewport: HTMLElement;
  private readonly board: HTMLElement;
  private readonly backgroundCanvas: HTMLCanvasElement;
  private readonly annotationCanvas: HTMLCanvasElement;
  private readonly eraserCursor: HTMLElement;
  private readonly backgroundContext: CanvasRenderingContext2D;
  private readonly annotationContext: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private readonly callbacks: CanvasCallbacks;
  private brush: BrushSettings;
  private shape: ShapeSettings;
  private tool: CanvasTool = "brush";
  private eraserSize = 32;
  private theme: CanvasTheme;
  private boardSize: CanvasSize = { ...DEFAULT_BOARD_SIZE };
  private baseImage: BaseImage | null = null;
  private hasInitializedView = false;
  private annotations: Annotation[] = [];
  private activeStroke: Stroke | null = null;
  private activeShape: ActiveShape | null = null;
  private activeEraserPoint: PointerPoint | null = null;
  private isPointerOverCanvas = false;
  private pixelRatio = 1;
  private view: ViewState = {
    x: 0,
    y: 0,
    scale: 1,
  };

  constructor(
    elements: CanvasElements,
    brush: BrushSettings,
    shape: ShapeSettings,
    theme: CanvasTheme,
    callbacks: CanvasCallbacks = {},
  ) {
    this.viewport = elements.viewport;
    this.board = elements.board;
    this.backgroundCanvas = elements.background;
    this.annotationCanvas = elements.annotation;
    this.eraserCursor = elements.eraserCursor;
    this.callbacks = callbacks;
    this.brush = cloneBrush(brush);
    this.shape = cloneShapeSettings(shape);
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
    this.annotationCanvas.addEventListener("pointercancel", this.handlePointerCancel);
    this.annotationCanvas.addEventListener("lostpointercapture", this.handlePointerCancel);
    this.annotationCanvas.addEventListener("pointerenter", this.handlePointerEnter);
    this.annotationCanvas.addEventListener("pointerleave", this.handlePointerLeave);

    this.configureCanvases();
    this.resetView();
  }

  updateBrush(brush: BrushSettings): void {
    this.brush = cloneBrush(brush);
  }

  updateShape(shape: ShapeSettings): void {
    this.shape = cloneShapeSettings(shape);

    if (this.activeShape) {
      this.activeShape.settings = cloneShapeSettings(shape);
      this.renderAnnotations();
    }
  }

  updateTool(tool: CanvasTool): void {
    const hadActiveShape = this.activeShape !== null;
    this.tool = tool;
    this.activeStroke = null;
    this.activeShape = null;
    this.activeEraserPoint = null;
    this.annotationCanvas.dataset.tool = tool;
    this.syncEraserCursorVisibility();

    if (hadActiveShape) {
      this.renderAnnotations();
    }
  }

  updateEraserSize(size: number): void {
    this.eraserSize = Math.max(1, size);
    this.eraserCursor.style.width = `${this.eraserSize}px`;
    this.eraserCursor.style.height = `${this.eraserSize}px`;
  }

  updateTheme(theme: CanvasTheme): void {
    this.theme = theme;
    this.paintBackground();
    this.renderAnnotations();
  }

  newCanvas(size: CanvasSize): void {
    this.releaseBaseImage();
    this.clearAnnotations();
    this.boardSize = normalizeCanvasSize(size);
    this.configureCanvases();
    this.paintBackground();
    this.renderAnnotations();
    this.resetView();
  }

  setBaseImage(source: CanvasImageSource, size: CanvasSize): CanvasSize {
    const nextSize = normalizeImageSize(size);

    this.releaseBaseImage();
    this.baseImage = {
      source,
      width: size.width,
      height: size.height,
    };
    this.clearAnnotations();
    this.boardSize = nextSize;
    this.configureCanvases();
    this.paintBackground();
    this.renderAnnotations();
    this.resetView();

    return { ...nextSize };
  }

  toPngBlob(): Promise<Blob> {
    const outputCanvas = document.createElement("canvas");
    const outputContext = outputCanvas.getContext("2d");

    if (!outputContext) {
      return Promise.reject(new Error("Canvas export is not supported in this browser."));
    }

    outputCanvas.width = this.boardSize.width;
    outputCanvas.height = this.boardSize.height;

    if (this.baseImage) {
      outputContext.drawImage(
        this.baseImage.source,
        0,
        0,
        this.baseImage.width,
        this.baseImage.height,
        0,
        0,
        this.boardSize.width,
        this.boardSize.height,
      );
    } else {
      outputContext.fillStyle = this.theme.background;
      outputContext.fillRect(0, 0, this.boardSize.width, this.boardSize.height);
    }

    this.renderAnnotations(false);

    try {
      outputContext.drawImage(
        this.annotationCanvas,
        0,
        0,
        this.annotationCanvas.width,
        this.annotationCanvas.height,
        0,
        0,
        this.boardSize.width,
        this.boardSize.height,
      );
    } finally {
      this.renderAnnotations();
    }

    return new Promise((resolve, reject) => {
      outputCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("The canvas could not be encoded as a PNG."));
      }, "image/png");
    });
  }

  clearAnnotations(): void {
    this.annotations = [];
    this.activeStroke = null;
    this.activeShape = null;
    this.activeEraserPoint = null;
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
    this.releaseBaseImage();
    this.resizeObserver.disconnect();
    this.viewport.removeEventListener("wheel", this.handleWheel);
    this.annotationCanvas.removeEventListener("pointerdown", this.handlePointerDown);
    this.annotationCanvas.removeEventListener("pointermove", this.handlePointerMove);
    this.annotationCanvas.removeEventListener("pointerup", this.handlePointerUp);
    this.annotationCanvas.removeEventListener("pointercancel", this.handlePointerCancel);
    this.annotationCanvas.removeEventListener("lostpointercapture", this.handlePointerCancel);
    this.annotationCanvas.removeEventListener("pointerenter", this.handlePointerEnter);
    this.annotationCanvas.removeEventListener("pointerleave", this.handlePointerLeave);
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

    if (this.baseImage) {
      this.backgroundContext.drawImage(
        this.baseImage.source,
        0,
        0,
        this.baseImage.width,
        this.baseImage.height,
        0,
        0,
        width,
        height,
      );
      return;
    }

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

    this.isPointerOverCanvas = true;
    this.annotationCanvas.setPointerCapture(event.pointerId);
    const point = this.getPoint(event);

    if (this.tool === "stroke-eraser") {
      this.activeEraserPoint = point;
      this.updateEraserCursorPosition(point);
      this.syncEraserCursorVisibility();

      if (this.eraseStrokesAlong(point, point)) {
        this.renderAnnotations();
      }

      event.preventDefault();
      return;
    }

    if (this.tool === "shape") {
      this.activeShape = {
        start: point,
        end: point,
        constrainAspectRatio: event.shiftKey,
        settings: cloneShapeSettings(this.shape),
      };
      this.renderAnnotations();
      event.preventDefault();
      return;
    }

    this.activeStroke = {
      type: "stroke",
      points: [point],
      brush: cloneBrush(this.brush),
    };
    this.annotations.push(this.activeStroke);
    this.drawDot(point, this.activeStroke.brush);
    event.preventDefault();
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (this.tool === "stroke-eraser") {
      this.isPointerOverCanvas = this.isPointerInsideCanvas(event);
      this.updateEraserCursorPosition(this.getPoint(event));
      this.syncEraserCursorVisibility();
    }

    if (!this.activeStroke && !this.activeShape && !this.activeEraserPoint) {
      return;
    }

    const points = this.getEventPoints(event);

    if (this.activeEraserPoint) {
      let previousPoint = this.activeEraserPoint;
      let didErase = false;

      for (const point of points) {
        didErase = this.eraseStrokesAlong(previousPoint, point) || didErase;
        previousPoint = point;
      }

      this.activeEraserPoint = previousPoint;

      if (didErase) {
        this.renderAnnotations();
      }

      event.preventDefault();
      return;
    }

    if (this.activeShape) {
      this.activeShape.end = this.getPoint(event);
      this.activeShape.constrainAspectRatio = event.shiftKey;
      this.renderAnnotations();
      event.preventDefault();
      return;
    }

    const activeStroke = this.activeStroke;

    if (!activeStroke) {
      return;
    }

    for (const point of points) {
      const previousPoint = activeStroke.points.at(-1);

      if (!previousPoint) {
        continue;
      }

      activeStroke.points.push(point);
      this.drawLine(previousPoint, point, activeStroke.brush);
    }

    event.preventDefault();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.activeStroke && !this.activeShape && !this.activeEraserPoint) {
      return;
    }

    if (this.activeShape) {
      this.activeShape.end = this.getPoint(event);
      this.activeShape.constrainAspectRatio = event.shiftKey;
      const bounds = this.getActiveShapeBounds(this.activeShape);

      if (bounds.width >= MIN_SHAPE_SIZE && bounds.height >= MIN_SHAPE_SIZE) {
        this.annotations.push({
          type: "shape",
          bounds,
          settings: cloneShapeSettings(this.activeShape.settings),
        });
      }
    }

    this.activeStroke = null;
    this.activeShape = null;
    this.activeEraserPoint = null;
    this.renderAnnotations();

    if (this.annotationCanvas.hasPointerCapture(event.pointerId)) {
      this.annotationCanvas.releasePointerCapture(event.pointerId);
    }
  };

  private handlePointerCancel = (): void => {
    const hadActiveShape = this.activeShape !== null;
    this.activeStroke = null;
    this.activeShape = null;
    this.activeEraserPoint = null;

    if (hadActiveShape) {
      this.renderAnnotations();
    }
  };

  private handlePointerEnter = (event: PointerEvent): void => {
    this.isPointerOverCanvas = true;

    if (this.tool === "stroke-eraser") {
      this.updateEraserCursorPosition(this.getPoint(event));
    }

    this.syncEraserCursorVisibility();
  };

  private handlePointerLeave = (): void => {
    this.isPointerOverCanvas = false;
    this.syncEraserCursorVisibility();
  };

  private getEventPoints(event: PointerEvent): PointerPoint[] {
    const coalescedEvents =
      typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [];
    const points = coalescedEvents.map((coalescedEvent) => this.getPoint(coalescedEvent));

    if (points.length === 0) {
      points.push(this.getPoint(event));
    }

    return points;
  }

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

      this.callbacks.onToolSizeChange?.(-steps);
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

  private renderAnnotations(includeActive = true): void {
    this.annotationContext.clearRect(
      0,
      0,
      this.annotationCanvas.width,
      this.annotationCanvas.height,
    );

    this.annotations.forEach((annotation) => {
      if (!includeActive && annotation === this.activeStroke) {
        return;
      }

      if (annotation.type === "stroke") {
        this.renderStroke(annotation);
      } else {
        this.renderShape(annotation);
      }
    });

    if (includeActive && this.activeShape) {
      this.renderShape({
        type: "shape",
        bounds: this.getActiveShapeBounds(this.activeShape),
        settings: this.activeShape.settings,
      });
    }
  }

  private eraseStrokesAlong(from: PointerPoint, to: PointerPoint): boolean {
    const eraserRadius = this.eraserSize / 2;
    const remainingAnnotations = this.annotations.filter(
      (annotation) =>
        !this.annotationIntersectsEraser(annotation, from, to, eraserRadius),
    );

    if (remainingAnnotations.length === this.annotations.length) {
      return false;
    }

    this.annotations = remainingAnnotations;
    return true;
  }

  private annotationIntersectsEraser(
    annotation: Annotation,
    eraserStart: PointerPoint,
    eraserEnd: PointerPoint,
    eraserRadius: number,
  ): boolean {
    if (annotation.type === "stroke") {
      return this.strokeIntersectsEraser(
        annotation,
        eraserStart,
        eraserEnd,
        eraserRadius,
      );
    }

    return shapeIntersectsSweptCircle(
      annotation.settings.kind,
      annotation.bounds,
      eraserStart,
      eraserEnd,
      eraserRadius,
      annotation.settings.strokeWidth,
      annotation.settings.style === "fill",
      getRoundedRectRadius(annotation.bounds, DEFAULT_ROUNDED_RECT_RADIUS),
    );
  }

  private strokeIntersectsEraser(
    stroke: Stroke,
    eraserStart: PointerPoint,
    eraserEnd: PointerPoint,
    eraserRadius: number,
  ): boolean {
    const firstPoint = stroke.points[0];

    if (!firstPoint) {
      return false;
    }

    const firstDotHitRadius =
      eraserRadius + this.getLogicalStrokeWidth(firstPoint.pressure, stroke.brush) / 2;

    if (
      distanceSquaredBetweenSegments(
        eraserStart,
        eraserEnd,
        firstPoint,
        firstPoint,
      ) <=
      firstDotHitRadius * firstDotHitRadius
    ) {
      return true;
    }

    if (stroke.points.length === 1) {
      return false;
    }

    for (let index = 1; index < stroke.points.length; index += 1) {
      const strokeStart = stroke.points[index - 1];
      const strokeEnd = stroke.points[index];
      const averagePressure = (strokeStart.pressure + strokeEnd.pressure) / 2;
      const hitRadius =
        eraserRadius + this.getLogicalStrokeWidth(averagePressure, stroke.brush) / 2;

      if (
        distanceSquaredBetweenSegments(
          eraserStart,
          eraserEnd,
          strokeStart,
          strokeEnd,
        ) <=
        hitRadius * hitRadius
      ) {
        return true;
      }
    }

    return false;
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

  private renderShape(shape: ShapeAnnotation): void {
    const { bounds, settings } = shape;

    if (bounds.width < MIN_SHAPE_SIZE || bounds.height < MIN_SHAPE_SIZE) {
      return;
    }

    const x = bounds.x * this.pixelRatio;
    const y = bounds.y * this.pixelRatio;
    const width = bounds.width * this.pixelRatio;
    const height = bounds.height * this.pixelRatio;

    this.annotationContext.save();
    this.annotationContext.beginPath();

    if (settings.kind === "ellipse") {
      this.annotationContext.ellipse(
        x + width / 2,
        y + height / 2,
        width / 2,
        height / 2,
        0,
        0,
        Math.PI * 2,
      );
    } else if (settings.kind === "rounded-rectangle") {
      const radius =
        getRoundedRectRadius(bounds, DEFAULT_ROUNDED_RECT_RADIUS) * this.pixelRatio;
      this.annotationContext.roundRect(x, y, width, height, radius);
    } else {
      this.annotationContext.rect(x, y, width, height);
    }

    if (settings.style === "fill") {
      this.annotationContext.fillStyle = settings.color[this.theme.mode];
      this.annotationContext.fill();
    } else {
      this.annotationContext.strokeStyle = settings.color[this.theme.mode];
      this.annotationContext.lineWidth = settings.strokeWidth * this.pixelRatio;
      this.annotationContext.lineJoin = "round";
      this.annotationContext.stroke();
    }
    this.annotationContext.restore();
  }

  private getActiveShapeBounds(shape: ActiveShape): ShapeBounds {
    return getShapeBounds(shape.start, shape.end, shape.constrainAspectRatio);
  }

  private drawDot(point: PointerPoint, brush: BrushSettings): void {
    const radius = this.getStrokeWidth(point.pressure, brush) / 2;

    this.annotationContext.save();
    this.annotationContext.globalAlpha = brush.opacity;
    this.annotationContext.fillStyle = brush.color[this.theme.mode];
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
    this.annotationContext.strokeStyle = brush.color[this.theme.mode];
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
    return this.getLogicalStrokeWidth(pressure, brush) * this.pixelRatio;
  }

  private getLogicalStrokeWidth(pressure: number, brush: BrushSettings): number {
    const pressureScale = 0.65 + pressure * 0.7;
    return brush.size * pressureScale;
  }

  private updateEraserCursorPosition(point: PointerPoint): void {
    this.eraserCursor.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`;
  }

  private isPointerInsideCanvas(event: PointerEvent): boolean {
    const rect = this.annotationCanvas.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  private syncEraserCursorVisibility(): void {
    this.eraserCursor.hidden =
      this.tool !== "stroke-eraser" || !this.isPointerOverCanvas;
  }

  private releaseBaseImage(): void {
    if (
      typeof ImageBitmap !== "undefined" &&
      this.baseImage?.source instanceof ImageBitmap
    ) {
      this.baseImage.source.close();
    }

    this.baseImage = null;
  }
}

type PointerPoint = {
  x: number;
  y: number;
  pressure: number;
};

const cloneBrush = (brush: BrushSettings): BrushSettings => ({
  color: { ...brush.color },
  size: brush.size,
  opacity: brush.opacity,
});

const cloneShapeSettings = (shape: ShapeSettings): ShapeSettings => ({
  kind: shape.kind,
  color: { ...shape.color },
  style: shape.style,
  strokeWidth: shape.strokeWidth,
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const normalizeCanvasSize = (size: CanvasSize): CanvasSize => ({
  width: Math.round(clamp(size.width, MIN_BOARD_SIZE, MAX_BOARD_SIZE)),
  height: Math.round(clamp(size.height, MIN_BOARD_SIZE, MAX_BOARD_SIZE)),
});

const normalizeImageSize = (size: CanvasSize): CanvasSize => {
  if (
    !Number.isFinite(size.width) ||
    !Number.isFinite(size.height) ||
    size.width <= 0 ||
    size.height <= 0
  ) {
    throw new Error("The clipboard image has invalid dimensions.");
  }

  const scale = Math.min(1, MAX_BOARD_SIZE / size.width, MAX_BOARD_SIZE / size.height);

  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
};
