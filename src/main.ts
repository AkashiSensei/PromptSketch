import {
  PromptCanvas,
  type BrushSettings,
  type CanvasTheme,
  type CanvasTool,
} from "./canvas";
import "./styles.css";

const COLOR_STORAGE_KEY = "promptsketch.color-overrides";
const COLOR_STORAGE_VERSION = 2;
const COLOR_SLOTS = [
  {
    id: "ink",
    label: "Black / White",
    defaultColors: { light: "#1f2320", dark: "#e7e4da" },
  },
  {
    id: "red",
    label: "Red",
    defaultColors: { light: "#e4572e", dark: "#ff8b70" },
  },
  {
    id: "blue",
    label: "Blue",
    defaultColors: { light: "#1f7a8c", dark: "#69c5d4" },
  },
  {
    id: "green",
    label: "Green",
    defaultColors: { light: "#2f7d4a", dark: "#72d69a" },
  },
  {
    id: "yellow",
    label: "Yellow",
    defaultColors: { light: "#f2c200", dark: "#f0cf5a" },
  },
] as const;

type ThemeMode = "light" | "dark";
type ColorSlotId = (typeof COLOR_SLOTS)[number]["id"];
type ColorPair = Record<ThemeMode, string>;
type ColorOverrides = Partial<Record<ColorSlotId, ColorPair>>;

type HslColor = {
  hue: number;
  saturation: number;
  lightness: number;
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const isColorSlotId = (value: string | undefined): value is ColorSlotId =>
  COLOR_SLOTS.some((slot) => slot.id === value);

const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const hexToHsl = (hexColor: string): HslColor => {
  const value = Number.parseInt(hexColor.slice(1), 16);
  const red = ((value >> 16) & 0xff) / 255;
  const green = ((value >> 8) & 0xff) / 255;
  const blue = (value & 0xff) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;

  if (difference !== 0) {
    if (maximum === red) {
      hue = ((green - blue) / difference) % 6;
    } else if (maximum === green) {
      hue = (blue - red) / difference + 2;
    } else {
      hue = (red - green) / difference + 4;
    }

    hue *= 60;

    if (hue < 0) {
      hue += 360;
    }
  }

  const saturation =
    difference === 0 ? 0 : difference / (1 - Math.abs(2 * lightness - 1));

  return {
    hue,
    saturation: saturation * 100,
    lightness: lightness * 100,
  };
};

const hslToHex = ({ hue, saturation, lightness }: HslColor): string => {
  const normalizedSaturation = saturation / 100;
  const normalizedLightness = lightness / 100;
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const hueSegment = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSegment % 2) - 1));
  const match = normalizedLightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSegment < 1) {
    red = chroma;
    green = secondary;
  } else if (hueSegment < 2) {
    red = secondary;
    green = chroma;
  } else if (hueSegment < 3) {
    green = chroma;
    blue = secondary;
  } else if (hueSegment < 4) {
    green = secondary;
    blue = chroma;
  } else if (hueSegment < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  const toHexChannel = (channel: number): string =>
    Math.round((channel + match) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}`;
};

const createThemeColorPair = (color: string, sourceTheme: ThemeMode): ColorPair => {
  const hslColor = hexToHsl(color);
  const pairedLightness =
    sourceTheme === "light"
      ? clampNumber(100 - hslColor.lightness, 62, 82)
      : clampNumber(100 - hslColor.lightness, 18, 42);
  const pairedColor = hslToHex({
    ...hslColor,
    lightness: pairedLightness,
  });

  return sourceTheme === "light"
    ? { light: color, dark: pairedColor }
    : { light: pairedColor, dark: color };
};

const loadColorOverrides = (): ColorOverrides => {
  try {
    const storedValue = localStorage.getItem(COLOR_STORAGE_KEY);

    if (!storedValue) {
      return {};
    }

    const parsedValue: unknown = JSON.parse(storedValue);

    if (
      typeof parsedValue !== "object" ||
      parsedValue === null ||
      !("version" in parsedValue) ||
      !("overrides" in parsedValue) ||
      typeof parsedValue.overrides !== "object" ||
      parsedValue.overrides === null
    ) {
      return {};
    }

    const storedOverrides = parsedValue.overrides as Record<string, unknown>;
    const validOverrides: ColorOverrides = {};

    COLOR_SLOTS.forEach((slot) => {
      const storedOverride =
        storedOverrides[slot.id] ??
        (slot.id === "yellow" ? storedOverrides.ochre : undefined);

      if (parsedValue.version === 1 && isHexColor(storedOverride)) {
        validOverrides[slot.id] = createThemeColorPair(
          storedOverride.toLowerCase(),
          "light",
        );
        return;
      }

      if (
        parsedValue.version === COLOR_STORAGE_VERSION &&
        typeof storedOverride === "object" &&
        storedOverride !== null &&
        "light" in storedOverride &&
        "dark" in storedOverride &&
        isHexColor(storedOverride.light) &&
        isHexColor(storedOverride.dark)
      ) {
        validOverrides[slot.id] = {
          light: storedOverride.light.toLowerCase(),
          dark: storedOverride.dark.toLowerCase(),
        };
      }
    });

    return validOverrides;
  } catch {
    return {};
  }
};

const saveColorOverrides = (overrides: ColorOverrides): void => {
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(COLOR_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      COLOR_STORAGE_KEY,
      JSON.stringify({
        version: COLOR_STORAGE_VERSION,
        overrides,
      }),
    );
  } catch {
    // Drawing remains usable when browser storage is unavailable.
  }
};

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
              data-tool="stroke-eraser"
              aria-label="Stroke Eraser — erase whole strokes"
              aria-pressed="false"
              title="Erase whole strokes"
            >Stroke eraser</button>
          </div>

          <label class="control control--inline brush-only" for="brush-color">
            <span>Color <output id="brush-color-slot" for="brush-color">Ink</output></span>
            <input id="brush-color" type="color" value="#1f2320" />
          </label>

          <label class="control" for="tool-size">
            <span class="control-row">
              <span id="tool-size-label" title="Option + scroll over the canvas">Brush size</span>
              <output id="tool-size-output" for="tool-size">8 px</output>
            </span>
            <input id="tool-size" type="range" min="2" max="48" step="1" value="8" />
          </label>

          <label class="control brush-only" for="brush-opacity">
            <span class="control-row">
              <span>Opacity</span>
              <output id="brush-opacity-output" for="brush-opacity">100%</output>
            </span>
            <input id="brush-opacity" type="range" min="10" max="100" step="5" value="100" />
          </label>

          <div class="swatch-row brush-only" aria-label="Quick colors">
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
          <button class="secondary-button brush-only" id="reset-colors" type="button">Reset colors</button>
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
          <button class="clear-button" id="clear-canvas" type="button">Clear strokes</button>
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
const brushColor = app.querySelector<HTMLInputElement>("#brush-color");
const brushColorSlot = app.querySelector<HTMLOutputElement>("#brush-color-slot");
const toolSize = app.querySelector<HTMLInputElement>("#tool-size");
const toolSizeLabel = app.querySelector<HTMLElement>("#tool-size-label");
const toolSizeOutput = app.querySelector<HTMLOutputElement>("#tool-size-output");
const brushOpacity = app.querySelector<HTMLInputElement>("#brush-opacity");
const brushOpacityOutput = app.querySelector<HTMLOutputElement>("#brush-opacity-output");
const resetColorsButton = app.querySelector<HTMLButtonElement>("#reset-colors");
const themeToggle = app.querySelector<HTMLInputElement>("#theme-toggle");
const themeOutput = app.querySelector<HTMLOutputElement>("#theme-output");
const resetViewButton = app.querySelector<HTMLButtonElement>("#reset-view");
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
  !brushColor ||
  !brushColorSlot ||
  !toolSize ||
  !toolSizeLabel ||
  !toolSizeOutput ||
  !brushOpacity ||
  !brushOpacityOutput ||
  !resetColorsButton ||
  !themeToggle ||
  !themeOutput ||
  !resetViewButton ||
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

const getColorSlot = (slotId: ColorSlotId) =>
  COLOR_SLOTS.find((slot) => slot.id === slotId) ?? COLOR_SLOTS[0];

const getColorSlotValue = (
  slotId: ColorSlotId,
  theme: ThemeMode = activeTheme,
): string => {
  const slot = getColorSlot(slotId);
  return colorOverrides[slot.id]?.[theme] ?? slot.defaultColors[theme];
};

const getColorSlotPair = (slotId: ColorSlotId): ColorPair => ({
  light: getColorSlotValue(slotId, "light"),
  dark: getColorSlotValue(slotId, "dark"),
});

const getBrushSettings = (): BrushSettings => ({
  colors: getColorSlotPair(activeColorSlotId),
  size: brushSizeValue,
  opacity: Number(brushOpacity.value) / 100,
});

brushColor.value = getColorSlotValue(activeColorSlotId);

const adjustToolSize = (steps: number): void => {
  if (steps === 0) {
    return;
  }

  const min = Number(toolSize.min);
  const max = Number(toolSize.max);
  const step = Number(toolSize.step);
  const current = activeTool === "brush" ? brushSizeValue : eraserSizeValue;
  const next = Math.min(Math.max(current + steps * step, min), max);

  if (activeTool === "brush") {
    brushSizeValue = next;
    syncBrush();
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
  canvasThemes[activeTheme],
  {
    onToolSizeChange: adjustToolSize,
  },
);

const syncBrush = (): void => {
  brushOpacityOutput.value = `${brushOpacity.value}%`;
  promptCanvas.updateBrush(getBrushSettings());
  const activeSlot = getColorSlot(activeColorSlotId);

  brushColorSlot.value = activeSlot.label;

  swatches.forEach((swatch) => {
    const slotId = swatch.dataset.slot;

    if (!isColorSlotId(slotId)) {
      return;
    }

    const isSelected = slotId === activeColorSlotId;

    swatch.style.setProperty("--swatch-color", getColorSlotValue(slotId));
    swatch.classList.toggle("is-selected", isSelected);
    swatch.ariaPressed = String(isSelected);
  });
};

const syncToolControls = (): void => {
  const isBrush = activeTool === "brush";
  const activeSize = isBrush ? brushSizeValue : eraserSizeValue;

  toolSection.dataset.activeTool = activeTool;
  toolTitle.textContent = isBrush ? "Brush" : "Stroke Eraser";
  toolSizeLabel.textContent = isBrush ? "Brush size" : "Eraser size";
  toolSize.min = isBrush ? "2" : "8";
  toolSize.max = isBrush ? "48" : "96";
  toolSize.step = isBrush ? "1" : "2";
  toolSize.value = String(activeSize);
  toolSizeOutput.value = `${activeSize} px`;

  toolButtons.forEach((button) => {
    const isSelected = button.dataset.tool === activeTool;
    button.classList.toggle("is-selected", isSelected);
    button.ariaPressed = String(isSelected);
  });

  promptCanvas.updateTool(activeTool);
  promptCanvas.updateEraserSize(eraserSizeValue);
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

brushColor.addEventListener("input", () => {
  const activeSlot = getColorSlot(activeColorSlotId);
  const nextColor = brushColor.value.toLowerCase();

  if (nextColor === activeSlot.defaultColors[activeTheme]) {
    delete colorOverrides[activeColorSlotId];
  } else {
    colorOverrides[activeColorSlotId] = createThemeColorPair(nextColor, activeTheme);
  }

  saveColorOverrides(colorOverrides);
  syncBrush();
});
toolSize.addEventListener("input", () => {
  const nextSize = Number(toolSize.value);

  if (activeTool === "brush") {
    brushSizeValue = nextSize;
    syncBrush();
  } else {
    eraserSizeValue = nextSize;
    promptCanvas.updateEraserSize(eraserSizeValue);
  }

  toolSizeOutput.value = `${nextSize} px`;
});
brushOpacity.addEventListener("input", syncBrush);
themeToggle.addEventListener("change", () => {
  activeTheme = themeToggle.checked ? "dark" : "light";
  document.documentElement.dataset.theme = activeTheme;
  workspace.dataset.theme = activeTheme;
  brushColor.value = getColorSlotValue(activeColorSlotId);
  promptCanvas.updateTheme(canvasThemes[activeTheme]);
  syncThemeLabel();
  syncBrush();
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

swatches.forEach((swatch) => {
  const slotId = swatch.dataset.slot;

  if (!isColorSlotId(slotId)) {
    return;
  }

  swatch.addEventListener("click", () => {
    activeColorSlotId = slotId;
    brushColor.value = getColorSlotValue(activeColorSlotId);
    syncBrush();
  });
});

toolButtons.forEach((button) => {
  const tool = button.dataset.tool;

  if (tool !== "brush" && tool !== "stroke-eraser") {
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
  brushColor.value = getColorSlotValue(activeColorSlotId);
  syncBrush();
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
syncToolControls();
syncThemeLabel();

window.addEventListener("pagehide", () => promptCanvas.destroy(), { once: true });
