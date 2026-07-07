# ACTIVE_TASK

Status: COMPLETED on 2026-07-07

## Goal

Ship the first runnable PromptSketch version with a drawing canvas and a simple collapsible side control panel.

## Issue Reference

No external issue link or ID provided.

## Implementation Details

- Scaffold a static Vite + TypeScript app with no frontend framework.
- Present the app directly as the working surface: a large canvas area plus a compact side panel.
- Make the side panel collapsible, with the collapsed state preserving maximum drawing space.
- Include minimal brush controls in the panel: color, size, opacity, and clear/reset action.
- Support immediate freehand drawing on the canvas with pointer input.
- Use a canvas architecture that separates base/background rendering from annotation strokes, matching the eraser safety requirement.
- Keep the UI minimal and tool-like rather than a landing page or marketing page.
- Add light/dark theme switching with current brush color inversion.
- Add movable/resizable canvas view behavior, reset view, and a new-canvas dialog for width/height and aspect-ratio presets.
- Bind canvas wheel input to brush-size adjustment for tablet-friendly control.
- Defer clipboard paste/copy, save/download, eraser, undo, and shape tools to follow-up iterations.

## Test Plan

- Unit/build: run TypeScript/Vite build to confirm the scaffold compiles.
- Manual UI: open the dev server and verify the first screen is the canvas workspace, not a landing page.
- Manual drawing: draw with mouse/trackpad and confirm strokes appear with selected color, size, and opacity.
- Manual layout: collapse and expand the side panel and verify the canvas remains usable at desktop and narrow widths.
- Regression check: verify no source changes are made outside the Vite app scaffold and task-relevant files.

## Focusing Files

- `package.json`
- `index.html`
- `src/main.ts`
- `src/styles.css`
- `src/canvas.ts`

## Technical Context

- PromptSketch is a lightweight sketching tool for quickly creating visual prompts for AI tools.
- It should stay fast, minimal, clipboard-centered, local-first, and static.
- The initial technical direction is TypeScript + Vite with no frontend framework.
- Static deployment to GitHub Pages is the intended hosting path.
- Rendering should eventually separate base image/background from annotations so erasing never damages pasted images or the chosen background.

## Completion Notes

- Built the first runnable demo as a Vite + TypeScript static app.
- Implemented a full-window drawing canvas with layered background and annotation canvases.
- Added compact right-side controls for brush settings, appearance, view reset, and canvas lifecycle actions.
- Added a modal new-canvas workflow with aspect-ratio presets and bounded width/height inputs.
- Verified with `make build`; HTTP smoke testing passed earlier, while Playwright browser automation was unavailable because no local browser binary was installed.

## Task Checklist

- [x] Create the Vite + TypeScript project scaffold in the existing repository.
- [x] Add a full-viewport application shell with canvas workspace and side controls.
- [x] Implement a responsive collapsible side panel.
- [x] Implement pointer-based freehand drawing on the canvas.
- [x] Add brush color, size, opacity, and clear/reset controls.
- [x] Size the canvas correctly for device pixel ratio and window resizing.
- [x] Style the interface as a quiet, efficient tool surface.
- [x] Add light/dark mode with current brush color inversion.
- [x] Add reset view and new canvas sizing flow.
- [x] Bind canvas wheel input to brush-size changes.
- [x] Run build verification and HTTP smoke test; browser automation is unavailable without a local Playwright browser binary.
