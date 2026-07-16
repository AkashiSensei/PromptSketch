# ACTIVE_TASK

Status: COMPLETED on 2026-07-16

## Goal

Add a fast image I/O workflow that pastes a clipboard image into the canvas, copies the composed sketch as a PNG, and saves it through a file picker or compatible download fallback.

## Issue Reference

- User-requested feature; no GitHub issue or external issue ID was provided.

## Implementation Details

- Add a compact Input / Output section to the existing side panel with Paste, Copy, and Save buttons, including visible shortcut hints and a small non-blocking status/error message.
- Treat a pasted image as the immutable base layer: replace the current base image, adopt its natural pixel dimensions, proportionally downscale only when an edge exceeds the existing 4096-pixel safety cap, clear existing annotations, and reset the view so the image is immediately visible. The 320-pixel minimum remains a blank-canvas dialog rule rather than stretching small pasted images.
- Accept the first clipboard item whose MIME type starts with `image/`. Support both the native `paste` event (`Cmd/Ctrl+V`) and a Paste button backed by the async Clipboard API when the browser permits it.
- Keep the pasted bitmap independent from annotations and theme changes. A pasted image replaces the theme background/grid visually; creating a new blank canvas removes the pasted image and restores the themed blank background.
- Add one canonical PNG composition path in `PromptCanvas` that renders the base/background and current committed annotations at logical canvas dimensions, excluding editor chrome, zoom/pan transforms, grid-only viewport decoration, cursors, and in-progress pointer state.
- Use that same PNG result for Copy and Save. Copy writes `image/png` through `ClipboardItem`; Save first uses the browser's native save-file picker when available and falls back to a normal PNG download when it is not.
- Handle `Cmd/Ctrl+C`, `Cmd/Ctrl+V`, and `Cmd/Ctrl+S` at application level. Do not intercept shortcuts while focus is in an editable form control, while text is selected for copying, or while a modal dialog is open. Prevent the browser's default page-save action only when PromptSketch handles Save.
- Surface permission denial, unsupported clipboard formats/APIs, image decoding failures, and save cancellation without crashing or destroying the current canvas. User cancellation is informational rather than an error.
- Use a stable default filename such as `promptsketch-YYYYMMDD-HHmmss.png`.

## Test Plan

- Build/type check: run `npm run build` and resolve all strict TypeScript or bundling errors.
- Manual paste tests: paste PNG/JPEG screenshots via `Cmd/Ctrl+V`; use the Paste button; verify dimensions/aspect ratio, cleared annotations, reset view, unchanged image across theme switches, unsupported clipboard content, and denied clipboard permission.
- Manual copy tests: draw strokes and shapes over both blank and pasted canvases, copy by button and `Cmd/Ctrl+C`, paste into another image-capable app, and verify pixel dimensions, colors, opacity, base image, and absence of editor UI/cursor/grid artifacts.
- Manual save tests: use button and `Cmd/Ctrl+S`, verify native picker behavior where supported, download fallback elsewhere, PNG filename/type/content, cancellation behavior, and that browser page-save does not open when the app handles the shortcut.
- Interaction regression: verify shortcuts do not override copying selected text or editing form fields, the New canvas flow restores a blank themed canvas, erasing still affects only annotations, and draw/shape/theme/pan/zoom behavior remains intact.
- Browser coverage: exercise current Chromium and Safari behavior at minimum because clipboard writing, clipboard reading, and native file pickers have different support/permission paths.

## Focusing Files

- `src/canvas.ts` - base-image lifecycle, canvas sizing, canonical PNG composition, and export helpers.
- `src/main.ts` - Input / Output controls, clipboard/file operations, shortcut routing, and user feedback.
- `src/styles.css` - compact action layout, shortcut labels, and status states.
- `index.html` - only if browser capability metadata or document-level semantics are needed during implementation.

## Technical Context

- PromptSketch is TypeScript + Vite with no frontend framework and must remain a static, local-first app suitable for GitHub Pages.
- The retained annotation model in `PromptCanvas` already separates annotations from the background layer; the pasted image must preserve this boundary so the eraser never damages it.
- Clipboard image writing depends on a secure context, browser support, permissions, and a user gesture; web apps cannot reliably override every browser or system shortcut.
- The product is intentionally lightweight and clipboard-centered, not a project/document editor; pasted images and drawings are not persisted as projects.
- Blank-canvas dimensions are currently constrained to 320-4096 logical pixels. Pasted images should preserve their natural aspect ratio and may be smaller than 320 pixels, while retaining the 4096-pixel maximum safety cap; viewport zoom/pan is presentation state rather than exported content.

## Task Checklist

- [x] Introduce retained base-image state and explicit blank/image background rendering in `PromptCanvas`.
- [x] Add image replacement with proportional size normalization, annotation clearing, and view reset.
- [x] Add a single logical-resolution PNG composition/blob API shared by clipboard and file output.
- [x] Add Paste, Copy, and Save controls plus accessible busy/status/error feedback.
- [x] Implement native paste-event ingestion and permission-aware Paste button ingestion.
- [x] Implement PNG clipboard writing for Copy with unsupported/denied fallbacks reported to the user.
- [x] Implement native save picker capability detection, cancellation handling, and download fallback.
- [x] Route `Cmd/Ctrl+C`, `Cmd/Ctrl+V`, and `Cmd/Ctrl+S` without hijacking editable controls, selections, or modal dialogs.
- [x] Verify the core blank-canvas, pasted-image, New canvas, logical-resolution export, and runtime-error paths in the local browser.
- [x] Run `npm run build` and `git diff --check`.
- [x] Record platform-specific clipboard, keyboard shortcut, and native save-dialog checks for follow-up compatibility testing; the completed feature was accepted by the user.
