# SPECIFICATION

This file records the current project-level consensus for PromptSketch. It is not the only source of truth and should not be treated as a frozen implementation contract. Some implementation details below are early assumptions that may change after further discussion, prototyping, or real device testing.

For raw intent and open-ended ideas, see `RAW_REQUIREMENTS.md`. For task-specific implementation plans, use `ACTIVE_TASK.md` once a task starts.

## Project Overview

PromptSketch is a lightweight sketching tool for quickly creating visual prompts for AI tools. It should make it easy to paste in a screenshot or start from a blank canvas, draw simple annotations or rough shapes, then copy or save the result.

The product is not intended to become a full painting app, whiteboard, or design tool.

## Product Direction

- Fast to open and fast to use.
- Minimal interface focused on drawing, erasing, shapes, paste, copy, and save.
- Clipboard-centered workflow: paste image in, sketch over it, copy image out.
- Local-first and static: no account, no backend, no remote project storage.
- Annotation-safe: erasing should not damage pasted images or the chosen background.
- Useful for AI prompting and quick communication rather than polished illustration.

## Current Scope

The first useful version should explore:

- Pasting an image from the clipboard into the canvas.
- Drawing freehand strokes with mouse, trackpad, or stylus.
- Using pressure data when the browser and input device provide it.
- Brush and eraser tools.
- Simple shape tools such as rectangle, ellipse / circle, rounded rectangle, and line.
- A single shared theme-aware current color used by brush and shape tools; shapes switch between outline-only and solid-fill-only rendering.
- Undo for recent drawing or editing actions.
- Copying the composed image to the clipboard.
- Saving / downloading the composed image.
- Basic configurable preferences such as brush settings and shortcuts.

Future iterations may improve stroke smoothing, hold-to-straighten behavior, shape recognition, and installable PWA behavior.

## Current Technical Direction

The current preferred direction is:

- TypeScript + Vite.
- No frontend framework for the initial version.
- Static deployment to GitHub Pages.
- Browser APIs for canvas, pointer input, and clipboard.
- Local storage only for user preferences, not drawing projects.

These choices are tentative. If prototyping shows that another approach better serves speed, simplicity, or reliability, this spec should be updated.

## Known Constraints

- Browser clipboard image writing depends on secure context, browser support, permissions, and user gestures.
- Pressure support depends on hardware, driver, browser, and OS behavior.
- Web apps cannot reliably override every browser or system shortcut.
- GitHub Pages is appropriate for static hosting but not backend behavior.
