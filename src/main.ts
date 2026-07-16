import {
  PromptCanvas,
  type BrushSettings,
  type CanvasTheme,
  type CanvasTool,
  type ShapeKind,
  type ShapeSettings,
} from "./canvas";
import {
  COLOR_SLOTS,
  createThemeColorPair,
  getColorSlot,
  getColorSlotPair,
  getColorSlotValue,
  isColorSlotId,
  loadColorOverrides,
  saveColorOverrides,
  type ColorSlotId,
  type ThemeMode,
} from "./colors";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <main class="workspace" data-panel-state="open">
    <section class="canvas-shell" aria-label="Sketch canvas">
      <div class="canvas-stage" id="canvas-stage">
        <div class="canvas-board" id="canvas-board">
          <canvas class="canvas-layer" id="background-canvas" aria-hidden="true"></canvas>
          <canvas class="canvas-layer canvas-layer--drawing" id="annotation-canvas"></canvas>
          <div class="eraser-cursor" id="eraser-cursor" aria-hidden="true" hidden></div>
        </div>
      </div>
    </section>

    <aside class="side-panel" aria-label="Drawing controls">
      <button class="panel-toggle" id="panel-toggle" type="button" aria-expanded="true">
        Hide
      </button>

      <div class="panel-content">
        <section class="panel-section color-section" id="color-section" data-disabled="false" aria-labelledby="color-section-title">
          <header class="panel-header">
            <p class="eyebrow">Shared palette</p>
            <h2 id="color-section-title">Colors</h2>
          </header>

          <label class="control control--inline" for="active-color">
            <span>Color <output id="active-color-slot" for="active-color">Black / White</output></span>
            <input id="active-color" type="color" value="#1f2320" />
          </label>

          <div class="swatch-row" aria-label="Quick colors">
            ${COLOR_SLOTS.map(
              (slot, index) => `
                <button
                  class="swatch${index === 0 ? " is-selected" : ""}"
                  type="button"
                  data-slot="${slot.id}"
                  aria-label="${slot.label} color slot"
                  aria-pressed="${index === 0}"
                ></button>
              `,
            ).join("")}
          </div>
          <button class="secondary-button" id="reset-colors" type="button">Reset colors</button>
        </section>

        <section class="panel-section" id="tool-section" data-active-tool="brush" aria-labelledby="tool-section-title">
          <header class="panel-header">
            <p class="eyebrow">Tools</p>
            <h2 id="tool-section-title">Brush</h2>
          </header>

          <div class="tool-switch" role="group" aria-label="Drawing tool">
            <button
              class="tool-button is-selected"
              type="button"
              data-tool="brush"
              aria-pressed="true"
              title="Draw annotation strokes"
            >Brush</button>
            <button
              class="tool-button"
              type="button"
              data-tool="shape"
              aria-pressed="false"
              title="Draw geometric shapes"
            >Shape</button>
            <button
              class="tool-button"
              type="button"
              data-tool="stroke-eraser"
              aria-label="Stroke Eraser — erase whole annotations"
              aria-pressed="false"
              title="Erase whole annotations"
            >Eraser</button>
          </div>

          <label class="control shape-only" for="shape-kind">
            <span>Shape</span>
            <select id="shape-kind">
              <option value="rectangle">Rectangle</option>
              <option value="ellipse">Ellipse / circle</option>
              <option value="rounded-rectangle">Rounded rectangle</option>
            </select>
          </label>

          <label class="control" id="tool-size-control" for="tool-size">
            <span class="control-row">
              <span id="tool-size-label" title="Option + scroll over the canvas">Brush size</span>
              <output id="tool-size-output" for="tool-size">8 px</output>
            </span>
            <input id="tool-size" type="range" min="2" max="48" step="1" value="8" />
          </label>

          <label class="switch-control shape-only" for="shape-fill-enabled">
            <span>
              <span>Solid fill</span>
              <output id="shape-fill-output" for="shape-fill-enabled">Outline</output>
            </span>
            <input id="shape-fill-enabled" type="checkbox" />
          </label>

          <label class="control brush-only" for="brush-opacity">
            <span class="control-row">
              <span>Opacity</span>
              <output id="brush-opacity-output" for="brush-opacity">100%</output>
            </span>
            <input id="brush-opacity" type="range" min="10" max="100" step="5" value="100" />
          </label>
        </section>

        <section class="panel-section io-section" id="io-section" aria-labelledby="io-section-title" aria-busy="false">
          <header class="panel-header">
            <p class="eyebrow">Input / Output</p>
            <h2 id="io-section-title">Image</h2>
          </header>

          <div class="io-actions">
            <button class="io-button" id="paste-image" type="button">
              <span>Paste</span>
              <kbd data-shortcut="paste">⌘V</kbd>
            </button>
            <button class="io-button" id="copy-image" type="button">
              <span>Copy</span>
              <kbd data-shortcut="copy">⌘C</kbd>
            </button>
            <button class="io-button" id="save-image" type="button">
              <span>Save</span>
              <kbd data-shortcut="save">⌘S</kbd>
            </button>
          </div>
          <p class="io-status" id="io-status" data-state="idle" aria-live="polite">Ready</p>
        </section>

        <section class="panel-section" aria-labelledby="settings-section-title">
          <header class="panel-header">
            <p class="eyebrow">Settings</p>
            <h2 id="settings-section-title">Appearance</h2>
          </header>

          <label class="switch-control" for="theme-toggle">
            <span>
              <span>Dark mode</span>
              <output id="theme-output" for="theme-toggle">Light</output>
            </span>
            <input id="theme-toggle" type="checkbox" />
          </label>

          <button class="secondary-button" id="reset-view" type="button">Reset view</button>
        </section>

        <section class="panel-section" aria-labelledby="new-section-title">
          <header class="panel-header">
            <p class="eyebrow">New</p>
            <h2 id="new-section-title">Canvas</h2>
          </header>
          <button class="primary-button" id="open-new-canvas" type="button">New canvas</button>
          <button class="clear-button" id="clear-canvas" type="button">Clear annotations</button>
        </section>
      </div>
    </aside>

    <dialog class="canvas-dialog" id="new-canvas-dialog" aria-labelledby="new-canvas-dialog-title">
      <form class="dialog-panel" method="dialog">
        <header class="dialog-header">
          <p class="eyebrow">New</p>
          <h2 id="new-canvas-dialog-title">Canvas size</h2>
        </header>

        <label class="control" for="canvas-ratio">
          <span>Aspect ratio</span>
          <select id="canvas-ratio">
            <option value="16:10" selected>16:10</option>
            <option value="16:9">16:9</option>
            <option value="4:3">4:3</option>
            <option value="1:1">1:1</option>
            <option value="9:16">9:16</option>
            <option value="custom">Custom</option>
          </select>
        </label>

        <div class="dimension-grid">
          <label class="control" for="canvas-width">
            <span>Width</span>
            <input id="canvas-width" type="number" min="320" max="4096" step="1" value="1600" />
          </label>

          <label class="control" for="canvas-height">
            <span>Height</span>
            <input id="canvas-height" type="number" min="320" max="4096" step="1" value="1000" />
          </label>
        </div>

        <div class="dialog-actions">
          <button class="secondary-button" id="close-new-canvas" type="button">Cancel</button>
          <button class="primary-button" id="create-new-canvas" type="button">Create</button>
        </div>
      </form>
    </dialog>
  </main>
`;

const workspace = app.querySelector<HTMLElement>(".workspace");
const stage = app.querySelector<HTMLElement>("#canvas-stage");
const board = app.querySelector<HTMLElement>("#canvas-board");
const backgroundCanvas = app.querySelector<HTMLCanvasElement>("#background-canvas");
const annotationCanvas = app.querySelector<HTMLCanvasElement>("#annotation-canvas");
const eraserCursor = app.querySelector<HTMLElement>("#eraser-cursor");
const panelToggle = app.querySelector<HTMLButtonElement>("#panel-toggle");
const toolSection = app.querySelector<HTMLElement>("#tool-section");
const toolTitle = app.querySelector<HTMLElement>("#tool-section-title");
const shapeKindInput = app.querySelector<HTMLSelectElement>("#shape-kind");
const shapeFillEnabled = app.querySelector<HTMLInputElement>("#shape-fill-enabled");
const shapeFillOutput = app.querySelector<HTMLOutputElement>("#shape-fill-output");
const toolSizeControl = app.querySelector<HTMLElement>("#tool-size-control");
const toolSize = app.querySelector<HTMLInputElement>("#tool-size");
const toolSizeLabel = app.querySelector<HTMLElement>("#tool-size-label");
const toolSizeOutput = app.querySelector<HTMLOutputElement>("#tool-size-output");
const brushOpacity = app.querySelector<HTMLInputElement>("#brush-opacity");
const brushOpacityOutput = app.querySelector<HTMLOutputElement>("#brush-opacity-output");
const colorSection = app.querySelector<HTMLElement>("#color-section");
const activeColorInput = app.querySelector<HTMLInputElement>("#active-color");
const activeColorSlot = app.querySelector<HTMLOutputElement>("#active-color-slot");
const resetColorsButton = app.querySelector<HTMLButtonElement>("#reset-colors");
const themeToggle = app.querySelector<HTMLInputElement>("#theme-toggle");
const themeOutput = app.querySelector<HTMLOutputElement>("#theme-output");
const resetViewButton = app.querySelector<HTMLButtonElement>("#reset-view");
const ioSection = app.querySelector<HTMLElement>("#io-section");
const pasteImageButton = app.querySelector<HTMLButtonElement>("#paste-image");
const copyImageButton = app.querySelector<HTMLButtonElement>("#copy-image");
const saveImageButton = app.querySelector<HTMLButtonElement>("#save-image");
const ioStatus = app.querySelector<HTMLElement>("#io-status");
const newCanvasDialog = app.querySelector<HTMLDialogElement>("#new-canvas-dialog");
const canvasRatio = app.querySelector<HTMLSelectElement>("#canvas-ratio");
const canvasWidth = app.querySelector<HTMLInputElement>("#canvas-width");
const canvasHeight = app.querySelector<HTMLInputElement>("#canvas-height");
const openNewCanvasButton = app.querySelector<HTMLButtonElement>("#open-new-canvas");
const closeNewCanvasButton = app.querySelector<HTMLButtonElement>("#close-new-canvas");
const createNewCanvasButton = app.querySelector<HTMLButtonElement>("#create-new-canvas");
const clearButton = app.querySelector<HTMLButtonElement>("#clear-canvas");
const swatches = Array.from(app.querySelectorAll<HTMLButtonElement>(".swatch"));
const toolButtons = Array.from(app.querySelectorAll<HTMLButtonElement>(".tool-button"));

if (
  !workspace ||
  !stage ||
  !board ||
  !backgroundCanvas ||
  !annotationCanvas ||
  !eraserCursor ||
  !panelToggle ||
  !toolSection ||
  !toolTitle ||
  !shapeKindInput ||
  !shapeFillEnabled ||
  !shapeFillOutput ||
  !toolSizeControl ||
  !toolSize ||
  !toolSizeLabel ||
  !toolSizeOutput ||
  !brushOpacity ||
  !brushOpacityOutput ||
  !colorSection ||
  !activeColorInput ||
  !activeColorSlot ||
  !resetColorsButton ||
  !themeToggle ||
  !themeOutput ||
  !resetViewButton ||
  !ioSection ||
  !pasteImageButton ||
  !copyImageButton ||
  !saveImageButton ||
  !ioStatus ||
  !newCanvasDialog ||
  !canvasRatio ||
  !canvasWidth ||
  !canvasHeight ||
  !openNewCanvasButton ||
  !closeNewCanvasButton ||
  !createNewCanvasButton ||
  !clearButton
) {
  throw new Error("PromptSketch controls failed to initialize.");
}

type RatioPreset = keyof typeof ratioPresets;

let activeColorSlotId: ColorSlotId = COLOR_SLOTS[0].id;
let activeTheme: ThemeMode = "light";
let activeTool: CanvasTool = "brush";
let brushSizeValue = 8;
let shapeStrokeWidthValue = 4;
let eraserSizeValue = 32;
let colorOverrides = loadColorOverrides();

document.documentElement.dataset.theme = activeTheme;
workspace.dataset.theme = activeTheme;

const ratioPresets = {
  "16:10": 16 / 10,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "1:1": 1,
  "9:16": 9 / 16,
} as const;

const canvasThemes: Record<ThemeMode, CanvasTheme> = {
  light: {
    mode: "light",
    background: "#faf8f2",
    grid: "rgba(31, 35, 32, 0.075)",
  },
  dark: {
    mode: "dark",
    background: "#121613",
    grid: "rgba(242, 239, 229, 0.095)",
  },
};

const resolveColorSlotValue = (
  slotId: ColorSlotId,
  theme: ThemeMode = activeTheme,
): string => getColorSlotValue(slotId, theme, colorOverrides);

const resolveColorSlotPair = (slotId: ColorSlotId) =>
  getColorSlotPair(slotId, colorOverrides);

const getBrushSettings = (): BrushSettings => ({
  color: resolveColorSlotPair(activeColorSlotId),
  size: brushSizeValue,
  opacity: Number(brushOpacity.value) / 100,
});

const getShapeSettings = (): ShapeSettings => ({
  kind: shapeKindInput.value as ShapeKind,
  color: resolveColorSlotPair(activeColorSlotId),
  style: shapeFillEnabled.checked ? "fill" : "outline",
  strokeWidth: shapeStrokeWidthValue,
});

const adjustToolSize = (steps: number): void => {
  if (steps === 0) {
    return;
  }

  if (activeTool === "shape" && shapeFillEnabled.checked) {
    return;
  }

  const min = Number(toolSize.min);
  const max = Number(toolSize.max);
  const step = Number(toolSize.step);
  const current =
    activeTool === "brush"
      ? brushSizeValue
      : activeTool === "shape"
        ? shapeStrokeWidthValue
        : eraserSizeValue;
  const next = Math.min(Math.max(current + steps * step, min), max);

  if (activeTool === "brush") {
    brushSizeValue = next;
    syncBrush();
  } else if (activeTool === "shape") {
    shapeStrokeWidthValue = next;
    syncShape();
  } else {
    eraserSizeValue = next;
  }

  syncToolControls();
};

const promptCanvas = new PromptCanvas(
  {
    viewport: stage,
    board,
    background: backgroundCanvas,
    annotation: annotationCanvas,
    eraserCursor,
  },
  getBrushSettings(),
  getShapeSettings(),
  canvasThemes[activeTheme],
  {
    onToolSizeChange: adjustToolSize,
  },
);

type IoStatusState = "idle" | "info" | "success" | "error";

type DecodedImage = (ImageBitmap | HTMLImageElement) & {
  width: number;
  height: number;
};

type SaveFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<SaveFileHandle>;

let isIoBusy = false;

const setIoStatus = (message: string, state: IoStatusState = "info"): void => {
  ioStatus.textContent = message;
  ioStatus.dataset.state = state;
};

const setIoBusy = (isBusy: boolean): void => {
  isIoBusy = isBusy;
  ioSection.ariaBusy = String(isBusy);
  pasteImageButton.disabled = isBusy;
  copyImageButton.disabled = isBusy;
  saveImageButton.disabled = isBusy;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Clipboard or file access was not allowed.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The image operation could not be completed.";
};

const runIoAction = async (
  progressMessage: string,
  action: () => Promise<void>,
): Promise<void> => {
  if (isIoBusy) {
    return;
  }

  setIoBusy(true);
  setIoStatus(progressMessage, "info");

  try {
    await action();
  } catch (error) {
    setIoStatus(getErrorMessage(error), "error");
  } finally {
    setIoBusy(false);
  }
};

const decodeImageElement = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();

    image.addEventListener(
      "load",
      () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      },
      { once: true },
    );
    image.addEventListener(
      "error",
      () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The clipboard image could not be decoded."));
      },
      { once: true },
    );
    image.src = objectUrl;
  });

const decodeImage = async (blob: Blob): Promise<DecodedImage> => {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Some browsers decode clipboard formats more reliably through an image element.
    }
  }

  return decodeImageElement(blob);
};

const pasteImageBlob = async (blob: Blob): Promise<void> => {
  const image = await decodeImage(blob);

  try {
    const size = promptCanvas.setBaseImage(image, {
      width: image.width,
      height: image.height,
    });
    setIoStatus(`Pasted ${size.width} × ${size.height} image`, "success");
  } catch (error) {
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
      image.close();
    }

    throw error;
  }
};

const pasteFromClipboard = async (): Promise<void> => {
  if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
    throw new Error("Clipboard reading is unavailable. Use Cmd/Ctrl+V instead.");
  }

  const clipboardItems = await navigator.clipboard.read();

  for (const item of clipboardItems) {
    const imageType = item.types.find((type) => type.startsWith("image/"));

    if (imageType) {
      await pasteImageBlob(await item.getType(imageType));
      return;
    }
  }

  throw new Error("The clipboard does not contain an image.");
};

const copyImage = async (): Promise<void> => {
  if (
    !navigator.clipboard ||
    typeof navigator.clipboard.write !== "function" ||
    typeof ClipboardItem === "undefined"
  ) {
    throw new Error("Copying images is not supported in this browser.");
  }

  const pngBlob = promptCanvas.toPngBlob();
  const clipboardItem = new ClipboardItem({ "image/png": pngBlob });

  await navigator.clipboard.write([clipboardItem]);
  setIoStatus("Copied PNG to the clipboard", "success");
};

const createPngFilename = (): string => {
  const now = new Date();
  const pad = (value: number): string => String(value).padStart(2, "0");

  return `promptsketch-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
};

const getSaveFilePicker = (): SaveFilePicker | undefined =>
  (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker?.bind(
    window,
  );

const downloadPng = (blob: Blob, filename: string): void => {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};

const saveImage = async (): Promise<void> => {
  const filename = createPngFilename();
  const showSaveFilePicker = getSaveFilePicker();

  if (showSaveFilePicker) {
    let fileHandle: SaveFileHandle;

    try {
      fileHandle = await showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: "PNG image",
            accept: { "image/png": [".png"] },
          },
        ],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setIoStatus("Save canceled", "info");
        return;
      }

      throw error;
    }

    const pngBlob = await promptCanvas.toPngBlob();
    const writable = await fileHandle.createWritable();

    await writable.write(pngBlob);
    await writable.close();
    setIoStatus(`Saved ${filename}`, "success");
    return;
  }

  downloadPng(await promptCanvas.toPngBlob(), filename);
  setIoStatus(`Downloaded ${filename}`, "success");
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  const element = target instanceof Element ? target : document.activeElement;

  return Boolean(
    element?.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
    ),
  );
};

const hasSelectedText = (): boolean => {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString());
};

const shouldPreserveNativeEditing = (target: EventTarget | null): boolean =>
  newCanvasDialog.open || isEditableTarget(target);

const syncShortcutHints = (): void => {
  const modifier = /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘" : "Ctrl+";
  const shortcuts = {
    paste: `${modifier}V`,
    copy: `${modifier}C`,
    save: `${modifier}S`,
  };

  app.querySelectorAll<HTMLElement>("[data-shortcut]").forEach((hint) => {
    const shortcut = hint.dataset.shortcut as keyof typeof shortcuts | undefined;

    if (shortcut) {
      hint.textContent = shortcuts[shortcut];
    }
  });
};

const syncBrush = (): void => {
  brushOpacityOutput.value = `${brushOpacity.value}%`;
  promptCanvas.updateBrush(getBrushSettings());
};

const syncShape = (): void => {
  shapeFillOutput.value = shapeFillEnabled.checked ? "Filled" : "Outline";
  promptCanvas.updateShape(getShapeSettings());
};

const syncColors = (): void => {
  const selectedSlot = getColorSlot(activeColorSlotId);
  const isDisabled = activeTool === "stroke-eraser";

  colorSection.dataset.disabled = String(isDisabled);
  colorSection.setAttribute("aria-disabled", String(isDisabled));
  activeColorInput.disabled = isDisabled;
  resetColorsButton.disabled = isDisabled;
  activeColorInput.value = resolveColorSlotValue(activeColorSlotId);
  activeColorSlot.value = selectedSlot.label;

  swatches.forEach((swatch) => {
    const slotId = swatch.dataset.slot;

    if (!isColorSlotId(slotId)) {
      return;
    }

    const isSelected = slotId === activeColorSlotId;

    swatch.disabled = isDisabled;
    swatch.style.setProperty("--swatch-color", resolveColorSlotValue(slotId));
    swatch.classList.toggle("is-selected", isSelected);
    swatch.ariaPressed = String(isSelected);
  });
};

const syncToolControls = (): void => {
  const isBrush = activeTool === "brush";
  const isShape = activeTool === "shape";
  const activeSize = isBrush
    ? brushSizeValue
    : isShape
      ? shapeStrokeWidthValue
      : eraserSizeValue;

  toolSection.dataset.activeTool = activeTool;
  toolSection.dataset.shapeStyle = shapeFillEnabled.checked ? "fill" : "outline";
  toolSizeControl.hidden = isShape && shapeFillEnabled.checked;
  toolTitle.textContent = isBrush ? "Brush" : isShape ? "Shape" : "Stroke Eraser";
  toolSizeLabel.textContent = isBrush
    ? "Brush size"
    : isShape
      ? "Border width"
      : "Eraser size";
  toolSize.min = isBrush ? "2" : isShape ? "1" : "8";
  toolSize.max = isBrush ? "48" : isShape ? "24" : "96";
  toolSize.step = isBrush || isShape ? "1" : "2";
  toolSize.value = String(activeSize);
  toolSizeOutput.value = `${activeSize} px`;

  toolButtons.forEach((button) => {
    const isSelected = button.dataset.tool === activeTool;
    button.classList.toggle("is-selected", isSelected);
    button.ariaPressed = String(isSelected);
  });

  promptCanvas.updateTool(activeTool);
  promptCanvas.updateEraserSize(eraserSizeValue);
  syncColors();
};

const syncThemeLabel = (): void => {
  themeToggle.checked = activeTheme === "dark";
  themeOutput.value = activeTheme === "dark" ? "Dark" : "Light";
};

const readDimension = (input: HTMLInputElement): number => {
  const value = Number(input.value);

  if (!Number.isFinite(value)) {
    return Number(input.defaultValue);
  }

  return Math.round(Math.min(Math.max(value, 320), 4096));
};

const applyRatioPreset = (): void => {
  const ratio = ratioPresets[canvasRatio.value as RatioPreset];

  if (!ratio) {
    return;
  }

  const width = readDimension(canvasWidth);
  const height = Math.round(Math.min(Math.max(width / ratio, 320), 4096));

  canvasWidth.value = String(width);
  canvasHeight.value = String(height);
};

activeColorInput.addEventListener("input", () => {
  const selectedSlot = getColorSlot(activeColorSlotId);
  const nextColor = activeColorInput.value.toLowerCase();

  if (nextColor === selectedSlot.defaultColors[activeTheme]) {
    delete colorOverrides[activeColorSlotId];
  } else {
    colorOverrides[activeColorSlotId] = createThemeColorPair(nextColor, activeTheme);
  }

  saveColorOverrides(colorOverrides);
  syncBrush();
  syncShape();
  syncColors();
});
toolSize.addEventListener("input", () => {
  const nextSize = Number(toolSize.value);

  if (activeTool === "brush") {
    brushSizeValue = nextSize;
    syncBrush();
  } else if (activeTool === "shape") {
    shapeStrokeWidthValue = nextSize;
    syncShape();
  } else {
    eraserSizeValue = nextSize;
    promptCanvas.updateEraserSize(eraserSizeValue);
  }

  toolSizeOutput.value = `${nextSize} px`;
});
brushOpacity.addEventListener("input", syncBrush);
shapeKindInput.addEventListener("change", syncShape);
shapeFillEnabled.addEventListener("change", () => {
  syncShape();
  syncToolControls();
});
themeToggle.addEventListener("change", () => {
  activeTheme = themeToggle.checked ? "dark" : "light";
  document.documentElement.dataset.theme = activeTheme;
  workspace.dataset.theme = activeTheme;
  promptCanvas.updateTheme(canvasThemes[activeTheme]);
  syncThemeLabel();
  syncBrush();
  syncShape();
  syncColors();
});
canvasRatio.addEventListener("change", applyRatioPreset);
canvasWidth.addEventListener("input", () => {
  if (canvasRatio.value !== "custom") {
    applyRatioPreset();
  }
});
canvasHeight.addEventListener("input", () => {
  canvasRatio.value = "custom";
});

pasteImageButton.addEventListener("click", () => {
  void runIoAction("Reading clipboard…", pasteFromClipboard);
});

copyImageButton.addEventListener("click", () => {
  void runIoAction("Preparing PNG…", copyImage);
});

saveImageButton.addEventListener("click", () => {
  void runIoAction("Opening save dialog…", saveImage);
});

document.addEventListener("paste", (event) => {
  if (isIoBusy || shouldPreserveNativeEditing(event.target)) {
    return;
  }

  const imageFile = Array.from(event.clipboardData?.items ?? [])
    .find((item) => item.kind === "file" && item.type.startsWith("image/"))
    ?.getAsFile();

  if (!imageFile) {
    setIoStatus("The clipboard does not contain an image.", "error");
    return;
  }

  event.preventDefault();
  void runIoAction("Pasting image…", () => pasteImageBlob(imageFile));
});

document.addEventListener("copy", (event) => {
  if (
    isIoBusy ||
    shouldPreserveNativeEditing(event.target) ||
    hasSelectedText()
  ) {
    return;
  }

  event.preventDefault();
  void runIoAction("Preparing PNG…", copyImage);
});

document.addEventListener("keydown", (event) => {
  const usesPlatformModifier = event.metaKey || event.ctrlKey;

  if (
    !usesPlatformModifier ||
    event.altKey ||
    event.shiftKey ||
    event.key.toLowerCase() !== "s" ||
    shouldPreserveNativeEditing(event.target)
  ) {
    return;
  }

  event.preventDefault();
  void runIoAction("Opening save dialog…", saveImage);
});

swatches.forEach((swatch) => {
  const slotId = swatch.dataset.slot;

  if (!isColorSlotId(slotId)) {
    return;
  }

  swatch.addEventListener("click", () => {
    activeColorSlotId = slotId;
    syncBrush();
    syncShape();
    syncColors();
  });
});

toolButtons.forEach((button) => {
  const tool = button.dataset.tool;

  if (tool !== "brush" && tool !== "shape" && tool !== "stroke-eraser") {
    return;
  }

  button.addEventListener("click", () => {
    activeTool = tool;
    syncToolControls();
  });
});

resetColorsButton.addEventListener("click", () => {
  colorOverrides = {};
  saveColorOverrides(colorOverrides);
  syncBrush();
  syncShape();
  syncColors();
});

clearButton.addEventListener("click", () => {
  promptCanvas.clearAnnotations();
});

resetViewButton.addEventListener("click", () => {
  promptCanvas.resetView();
});

openNewCanvasButton.addEventListener("click", () => {
  newCanvasDialog.showModal();
});

closeNewCanvasButton.addEventListener("click", () => {
  newCanvasDialog.close();
});

newCanvasDialog.addEventListener("click", (event) => {
  if (event.target === newCanvasDialog) {
    newCanvasDialog.close();
  }
});

createNewCanvasButton.addEventListener("click", () => {
  const width = readDimension(canvasWidth);
  const height = readDimension(canvasHeight);

  canvasWidth.value = String(width);
  canvasHeight.value = String(height);
  promptCanvas.newCanvas({ width, height });
  setIoStatus(`Created ${width} × ${height} blank canvas`, "success");
  newCanvasDialog.close();
});

panelToggle.addEventListener("click", () => {
  const isOpen = workspace.dataset.panelState !== "closed";
  const nextState = isOpen ? "closed" : "open";

  workspace.dataset.panelState = nextState;
  panelToggle.ariaExpanded = String(nextState === "open");
  panelToggle.textContent = nextState === "open" ? "Hide" : "Show";
});

syncBrush();
syncShape();
syncToolControls();
syncThemeLabel();
syncShortcutHints();

window.addEventListener("pagehide", () => promptCanvas.destroy(), { once: true });
