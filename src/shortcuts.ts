import type { CanvasTool, ShapeKind } from "./canvas";
import type { ColorSlotId } from "./colors";

export type DrawingShortcut = {
  key: string;
  label: string;
  tool: CanvasTool;
  shapeKind?: ShapeKind;
};

export const CANVAS_ACTION_SHORTCUTS = {
  resetView: {
    key: "0",
    ariaKeyShortcuts: "0",
  },
  newCanvas: {
    key: "n",
    ariaKeyShortcuts: "Meta+N Control+N",
  },
  clearAnnotations: {
    key: "backspace",
    ariaKeyShortcuts: "Shift+Backspace",
  },
} as const;

export const DRAWING_SHORTCUTS: readonly DrawingShortcut[] = [
  { key: "b", label: "B", tool: "brush" },
  { key: "e", label: "E", tool: "stroke-eraser" },
  { key: "r", label: "R", tool: "shape", shapeKind: "rectangle" },
  { key: "o", label: "O", tool: "shape", shapeKind: "ellipse" },
  {
    key: "u",
    label: "U",
    tool: "shape",
    shapeKind: "rounded-rectangle",
  },
  { key: "l", label: "L", tool: "shape", shapeKind: "line" },
] as const;

export const COLOR_SHORTCUTS: Readonly<Record<ColorSlotId, string>> = {
  ink: "1",
  red: "2",
  blue: "3",
  green: "4",
  yellow: "5",
};

export const getDrawingShortcut = (
  key: string,
): DrawingShortcut | undefined =>
  DRAWING_SHORTCUTS.find((shortcut) => shortcut.key === key.toLowerCase());

export const getShapeShortcut = (shapeKind: ShapeKind): DrawingShortcut => {
  const shortcut = DRAWING_SHORTCUTS.find(
    (candidate) => candidate.shapeKind === shapeKind,
  );

  if (!shortcut) {
    throw new Error(`No shortcut is defined for shape: ${shapeKind}`);
  }

  return shortcut;
};

export const getColorSlotShortcut = (
  key: string,
): ColorSlotId | undefined => {
  const normalizedKey = key.toLowerCase();
  const entry = Object.entries(COLOR_SHORTCUTS).find(
    ([, shortcut]) => shortcut === normalizedKey,
  );

  return entry?.[0] as ColorSlotId | undefined;
};
