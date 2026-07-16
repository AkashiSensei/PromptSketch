# Stroke Eraser

Status: COMPLETED on 2026-07-16

## Goal

Add a stroke eraser that removes any complete annotation stroke touched by its swept hit area without affecting the background layer.

## Issue Reference

No external issue link or ID provided.

## Implementation Details

- Present the feature as a **Stroke Eraser** so users are not led to expect pixel-level trimming; the compact tool control may say `Eraser`, but its title, tooltip, or accessible description must clearly say `Erase whole strokes`.
- Model the active tool explicitly as `brush` or `stroke-eraser`; keep the internal eraser name precise even when the visible button uses the shorter label.
- Add a minimal brush/eraser tool selector to the existing Tools section and make the selected state visually and accessibly unambiguous.
- Keep brush settings intact while the eraser is selected. Use a separate in-memory eraser diameter so changing eraser size does not silently change brush size.
- Reuse the existing size control for the active tool, updating its label, range/value, and Option-scroll behavior when switching tools; do not add a second permanent size slider.
- Show a circular eraser cursor over the canvas whose logical diameter matches the active hit area across canvas zoom levels.
- During an eraser pointer gesture, treat the movement between consecutive pointer/coalesced points as a swept circle rather than testing isolated event positions, so quick movement cannot skip strokes between frames.
- Hit-test the swept eraser path against each retained stroke's full centerline and pressure-dependent rendered width. Handle single-point dots and multi-segment strokes.
- When any part of a retained stroke touches the eraser area, remove the entire stroke immediately. A stroke can be removed at most once in an eraser gesture.
- Re-render annotations from the retained stroke array after deletions; never erase annotation bitmap pixels as the source of truth.
- Keep the background canvas completely outside eraser hit-testing and rendering so grid, theme background, and future pasted images remain untouched.
- Preserve pointer capture, stylus pressure drawing, coalesced events, canvas pan/zoom, theme replay, high-DPI rendering, clear strokes, and new-canvas behavior.
- Keep pixel erasing, a selectable eraser-mode preference, keyboard shortcuts, and general undo/history out of this task. Structure deletion logic so an undo transaction can later record removed strokes and their positions without replacing the hit-test model.

## Test Plan

- Build/static: run the TypeScript/Vite production build and `git diff --check`.
- Geometry-focused verification: exercise point-to-point, point-to-segment, and swept-segment collision cases, including misses, tangent contact, crossing between sparse pointer events, pressure-width contact, single-point dots, and zero-length segments.
- UI: switch repeatedly between Brush and Stroke Eraser and confirm selected labels, accessible pressed state, size label/range/value, cursor, and per-tool sizes stay synchronized.
- Manual erasing: draw dots, short strokes, long strokes, intersecting strokes, narrow strokes, wide pressure strokes, and partially off-canvas strokes; touch each at its start, middle, end, and outer rendered edge and confirm the whole touched stroke disappears.
- Fast-input regression: erase quickly across several strokes and confirm swept collision catches every crossed stroke without requiring dense pointer events.
- Layer safety: erase over empty annotation space in both themes and confirm the background/grid remains unchanged; repeat once pasted-image support exists.
- Rendering regression: erase strokes, then switch themes, reset the view, zoom, resize the viewport, clear strokes, and create a new canvas; deleted strokes must never reappear.
- Input regression: verify mouse and stylus drawing remain pressure-sensitive, pointer cancellation/lost capture ends the active operation safely, trackpad pan/pinch still works, and Option-scroll adjusts the selected tool's size.
- Verification note: physical stylus, trackpad, and cross-device pixel-ratio checks were not available in the current environment and remain recommended hardware coverage rather than a blocker for this completed feature.

## Focusing Files

- `src/canvas.ts`
- `src/geometry.ts`
- `src/main.ts`
- `src/styles.css`

## Technical Context

- PromptSketch is a fast, minimal, local-first TypeScript/Vite app without a frontend framework or backend.
- The product is for quick visual prompting and annotation rather than full painting; whole-stroke deletion is the intentionally chosen MVP behavior.
- Annotation rendering is already separate from the background layer, and the eraser must never damage pasted images, the grid, or the chosen background.
- Retained logical `Stroke` objects are the source of truth; annotation canvas pixels are derived output replayed for theme and device-pixel-ratio changes.
- Stroke coordinates and eraser hit-testing must stay in logical board units so zoom and high-DPI rendering do not change deletion behavior.

## Task Checklist

- [x] Introduce explicit brush and stroke-eraser tool state and narrowly scoped eraser settings.
- [x] Add the compact tool selector with precise naming, selected state, tooltip, and accessible semantics.
- [x] Make the existing size control and Option-scroll operate on the active tool while preserving independent brush and eraser values.
- [x] Add a zoom-correct circular eraser cursor without disturbing pointer input.
- [x] Isolate logical-geometry helpers for point/segment distance and swept eraser collision.
- [x] Include rendered stroke width and pressure in collision thresholds, including dot strokes and degenerate segments.
- [x] Collect regular and coalesced pointer samples into a continuous eraser sweep.
- [x] Remove every touched retained stroke once per gesture and replay remaining annotations immediately.
- [x] Keep background rendering and future pasted-image content outside the deletion path.
- [x] Handle pointer up, cancellation, and lost capture cleanly for both tools.
- [x] Verify theme replay, whole-stroke deletion, untouched-stroke retention, background safety, independent tool sizes, and browser-console cleanliness.
- [x] Record unavailable physical stylus, trackpad, and device-pixel-ratio checks as recommended follow-up hardware coverage.
- [x] Run the build, static checks, geometry-focused checks, and manual UI test plan.
