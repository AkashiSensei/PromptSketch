# Theme-Aware Brush Colors

Status: COMPLETED on 2026-07-16

## Goal

Persist editable brush color slots and retained stroke objects so existing annotations follow the app theme without color drift.

## Issue Reference

No external issue link or ID provided.

## Implementation Details

- Retain the light/dark appearance control and switch the interface, canvas background, active brush, and every color slot together.
- Provide five quick-color slots as the primary brush choices: black/white, red, blue, green, and yellow, each with stable slot identity and theme-aware defaults.
- Give every slot a curated light/dark default pair rather than deriving defaults through RGB inversion.
- Use a bright, saturated yellow for the light-theme yellow slot rather than an ochre tone.
- Clicking a color slot selects it as the active brush color.
- The native color input edits the currently selected slot rather than acting as a separate unslotted color value.
- When a user edits a color, preserve that exact theme color and derive the opposite theme color by retaining hue/saturation while mapping lightness for the opposite background.
- Store explicit light/dark pairs so theme switching only reads stable values and never repeatedly transforms colors.
- Persist only slots whose colors the user has changed, using a small versioned `localStorage` record keyed by slot identity; migrate valid version-1 single-color overrides as light-theme source colors.
- On startup, merge valid stored pairs onto the built-in defaults; missing or invalid entries fall back independently to their default slot colors.
- Treat the former ochre override as a legacy alias for the yellow slot so existing local customization is preserved.
- Keep the selected slot synchronized with the canvas brush and the visible selected-state indicator.
- Add a color reset action that removes the color-override storage entry and immediately restores all built-in slot defaults.
- Reset affects future strokes and the color controls only; strokes already rendered on the canvas remain unchanged.
- Retain every completed or in-progress brush stroke as logical canvas points plus pressure, size, opacity, and a frozen light/dark color pair.
- Treat the annotation canvas as a render target rather than the source of truth; clear and replay retained strokes whenever the theme or device pixel ratio changes.
- Store stroke coordinates in logical board units so replay remains aligned across zoom, resize, and high-DPI rendering.
- Freeze the selected slot's color pair into each new stroke so later palette edits or resets do not restyle earlier work.
- Clear retained stroke objects together with the annotation pixels when clearing strokes or creating a new canvas.
- Reserve unmodified wheel gestures for canvas navigation: two-finger trackpad scrolling pans in both axes, while the macOS pinch gesture zooms continuously around the pointer position.
- Keep wheel-based brush sizing available behind Option + scroll so it no longer intercepts trackpad navigation.
- Do not bind double-click to zoom: rapid pen contacts may be synthesized as double-clicks and must never change the canvas scale.
- Do not expand this task into a general preferences system for brush size, opacity, shortcuts, or canvas state.

## Test Plan

- Build: run the TypeScript/Vite production build and `git diff --check`.
- Manual color selection: select every slot and confirm new strokes use the selected slot color.
- Manual editing: edit each slot through the color input and confirm the slot preview, active brush, and new strokes update together.
- Persistence: reload the page and confirm changed slots retain their overrides while untouched slots retain defaults.
- Theme switching: repeatedly switch themes and confirm the interface, canvas, active brush, and every slot change together without drift.
- Theme editing: modify a slot in either theme and confirm the source value is exact while the opposite theme receives a same-hue contrast-appropriate value.
- Storage resilience: provide missing, partial, malformed, and obsolete local data and confirm the app safely falls back to defaults without failing initialization.
- Reset: reset colors and confirm stored overrides are removed, both theme palettes return to defaults, and existing canvas strokes remain unchanged.
- Existing-stroke replay: draw with multiple colors, switch themes repeatedly, and confirm every existing stroke changes to its frozen paired color while geometry and pressure widths remain stable.
- Clear/new canvas: confirm clearing or replacing the canvas removes retained stroke objects so annotations do not reappear after a theme switch or resize.
- Render scaling: confirm retained logical coordinates replay in the same board position after viewport or device-pixel-ratio changes.
- Regression: verify brush size, opacity, drawing, canvas creation, panel collapse, and the previously configured development port still work.
- Trackpad navigation: verify two-axis wheel deltas pan without changing brush size, pinch-style Ctrl-wheel deltas zoom around the pointer, and Option-wheel still changes brush size without moving the canvas.

## Focusing Files

- `src/main.ts`
- `src/styles.css`
- `src/canvas.ts`
- `package.json`
- `Makefile`

## Technical Context

- PromptSketch must remain a fast, minimal, local-first static web app with no backend.
- Browser local storage is intended for lightweight user preferences, including brush colors, but not drawing projects.
- The current app uses TypeScript and Vite without a frontend framework.
- Annotation rendering is separate from the background layer; changing or resetting colors must not alter existing strokes.
- Theme switching must never repeatedly transform the current color; stable stored pairs prevent cumulative color drift.
- Annotation pixels are derived output; retained stroke objects are the in-memory source of truth for redraws and future undo/eraser work.

## Task Checklist

- [x] Restore the appearance section and synchronize interface, canvas, brush, and color slots with the active theme.
- [x] Define stable color-slot defaults and a selected-slot state.
- [x] Expand the curated palette to black/white, red, blue, green, and yellow, including legacy ochre-to-yellow migration.
- [x] Make the color input edit the selected slot and keep selection/rendering state synchronized.
- [x] Define curated default pairs and same-hue lightness mapping for user-edited colors.
- [x] Store explicit theme pairs to eliminate repeated-switch color drift.
- [x] Add narrowly scoped, versioned loading, migration, and saving for per-slot color overrides in `localStorage`.
- [x] Validate persisted values and fall back per slot when data is absent or invalid.
- [x] Add the reset-colors control and clear only PromptSketch's color-override storage key.
- [x] Restore and verify both light and dark visual styles.
- [x] Replace pixel-only annotation state with retained stroke objects containing logical points and frozen brush settings.
- [x] Replay all retained strokes with their theme-specific colors when the theme changes.
- [x] Replace annotation bitmap snapshots on resize with deterministic stroke replay.
- [x] Clear retained data together with rendered pixels for clear and new-canvas actions.
- [x] Verify multi-color existing strokes recolor correctly and do not return after clearing.
- [x] Separate trackpad pan/pinch navigation from Option-wheel brush-size adjustment.
- [x] Remove double-click zoom so stylus writing cannot accidentally enlarge the canvas.
- [x] Run build, static checks, and the manual behavior/regression test plan.
