import {
  PromptCanvas,
  type BrushSettings,
  type CanvasTheme,
} from "./canvas";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <main class="workspace" data-panel-state="open" data-theme="light">
    <section class="canvas-shell" aria-label="Sketch canvas">
      <div class="canvas-stage" id="canvas-stage">
        <div class="canvas-board" id="canvas-board">
          <canvas class="canvas-layer" id="background-canvas" aria-hidden="true"></canvas>
          <canvas class="canvas-layer canvas-layer--drawing" id="annotation-canvas"></canvas>
        </div>
      </div>
    </section>

    <aside class="side-panel" aria-label="Drawing controls">
      <button class="panel-toggle" id="panel-toggle" type="button" aria-expanded="true">
        Hide
      </button>

      <div class="panel-content">
        <section class="panel-section" aria-labelledby="brush-section-title">
          <header class="panel-header">
            <p class="eyebrow">Tools</p>
            <h2 id="brush-section-title">Brush</h2>
          </header>

          <label class="control control--inline" for="brush-color">
            <span>Color</span>
            <input id="brush-color" type="color" value="#1f2320" />
          </label>

          <label class="control" for="brush-size">
            <span class="control-row">
              <span>Size</span>
              <output id="brush-size-output" for="brush-size">8 px</output>
            </span>
            <input id="brush-size" type="range" min="2" max="48" step="1" value="8" />
          </label>

          <label class="control" for="brush-opacity">
            <span class="control-row">
              <span>Opacity</span>
              <output id="brush-opacity-output" for="brush-opacity">100%</output>
            </span>
            <input id="brush-opacity" type="range" min="10" max="100" step="5" value="100" />
          </label>

          <div class="swatch-row" aria-label="Quick colors">
            <button class="swatch is-selected" type="button" data-color="#1f2320" aria-label="Ink"></button>
            <button class="swatch" type="button" data-color="#e4572e" aria-label="Red"></button>
            <button class="swatch" type="button" data-color="#1f7a8c" aria-label="Blue"></button>
            <button class="swatch" type="button" data-color="#7a5c00" aria-label="Ochre"></button>
          </div>
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
const panelToggle = app.querySelector<HTMLButtonElement>("#panel-toggle");
const brushColor = app.querySelector<HTMLInputElement>("#brush-color");
const brushSize = app.querySelector<HTMLInputElement>("#brush-size");
const brushSizeOutput = app.querySelector<HTMLOutputElement>("#brush-size-output");
const brushOpacity = app.querySelector<HTMLInputElement>("#brush-opacity");
const brushOpacityOutput = app.querySelector<HTMLOutputElement>("#brush-opacity-output");
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

if (
  !workspace ||
  !stage ||
  !board ||
  !backgroundCanvas ||
  !annotationCanvas ||
  !panelToggle ||
  !brushColor ||
  !brushSize ||
  !brushSizeOutput ||
  !brushOpacity ||
  !brushOpacityOutput ||
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

type ThemeMode = "light" | "dark";
type RatioPreset = keyof typeof ratioPresets;

let activeTheme: ThemeMode = "light";

document.documentElement.dataset.theme = activeTheme;

const ratioPresets = {
  "16:10": 16 / 10,
  "16:9": 16 / 9,
  "4:3": 4 / 3,
  "1:1": 1,
  "9:16": 9 / 16,
} as const;

const getBrushSettings = (): BrushSettings => ({
  color: brushColor.value,
  size: Number(brushSize.value),
  opacity: Number(brushOpacity.value) / 100,
});

const getCanvasTheme = (theme: ThemeMode): CanvasTheme =>
  theme === "dark"
    ? {
        background: "#121613",
        grid: "rgba(242, 239, 229, 0.095)",
      }
    : {
        background: "#faf8f2",
        grid: "rgba(31, 35, 32, 0.075)",
      };

const adjustBrushSize = (steps: number): void => {
  if (steps === 0) {
    return;
  }

  const min = Number(brushSize.min);
  const max = Number(brushSize.max);
  const current = Number(brushSize.value);
  const next = Math.min(Math.max(current + steps, min), max);

  brushSize.value = String(next);
  syncBrush();
};

const promptCanvas = new PromptCanvas(
  {
    viewport: stage,
    board,
    background: backgroundCanvas,
    annotation: annotationCanvas,
  },
  getBrushSettings(),
  getCanvasTheme(activeTheme),
  {
    onBrushSizeChange: adjustBrushSize,
  },
);

const syncBrush = (): void => {
  brushSizeOutput.value = `${brushSize.value} px`;
  brushOpacityOutput.value = `${brushOpacity.value}%`;
  promptCanvas.updateBrush(getBrushSettings());

  swatches.forEach((swatch) => {
    swatch.classList.toggle("is-selected", swatch.dataset.color === brushColor.value);
  });
};

const syncThemeLabel = (): void => {
  themeToggle.checked = activeTheme === "dark";
  themeOutput.value = activeTheme === "dark" ? "Dark" : "Light";
};

const invertHexColor = (color: string): string => {
  const normalized = color.replace("#", "");
  const value = Number.parseInt(normalized, 16);

  if (Number.isNaN(value) || normalized.length !== 6) {
    return color;
  }

  return `#${(0xffffff - value).toString(16).padStart(6, "0")}`;
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

const applyTheme = (theme: ThemeMode): void => {
  if (theme === activeTheme) {
    return;
  }

  activeTheme = theme;
  document.documentElement.dataset.theme = activeTheme;
  workspace.dataset.theme = activeTheme;
  brushColor.value = invertHexColor(brushColor.value);
  promptCanvas.updateTheme(getCanvasTheme(activeTheme));
  syncThemeLabel();
  syncBrush();
};

brushColor.addEventListener("input", syncBrush);
brushSize.addEventListener("input", syncBrush);
brushOpacity.addEventListener("input", syncBrush);
themeToggle.addEventListener("change", () => {
  applyTheme(themeToggle.checked ? "dark" : "light");
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
  const color = swatch.dataset.color;

  if (!color) {
    return;
  }

  swatch.style.setProperty("--swatch-color", color);
  swatch.addEventListener("click", () => {
    brushColor.value = color;
    syncBrush();
  });
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
syncThemeLabel();

window.addEventListener("pagehide", () => promptCanvas.destroy(), { once: true });
