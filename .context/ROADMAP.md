# ROADMAP

## Milestones

- [x] Create GitHub repository with initial README.
- [x] Initialize project context system.
- [x] Scaffold Vite + TypeScript static app.
- [ ] Build MVP drawing workflow: paste image, draw, erase, copy, save.
- [ ] Add configurable shortcuts and brush settings.
- [x] Add shape tools.
- [ ] Tune stroke smoothing and pressure behavior.
- [ ] Deploy to GitHub Pages.

## Decisions

- 2026-07-07: Project name selected as `PromptSketch`.
- 2026-07-07: Product focus is quick visual prompts for AI tools, not general painting or whiteboarding.
- 2026-07-07: Chosen delivery model is a static web app deployable to GitHub Pages.
- 2026-07-07: Initial technical stack is TypeScript + Vite with no frontend framework.
- 2026-07-07: The app will not save project documents; only lightweight preferences may be stored locally.
- 2026-07-07: Rendering should separate base image / background from annotations so the eraser never damages pasted images.
- 2026-07-16: Brush and shape tools share one theme-aware current color; shapes render as either outline-only or solid-fill-only annotations.

## Completed Tasks

2026-07-07 | [Initial Demo](archive/20260707_Initial_Demo.md) | First runnable Vite/TypeScript demo with a drawable canvas, compact controls, theme switching, canvas sizing dialog, and brush-size wheel control.
2026-07-16 | [Theme-Aware Brush Colors](archive/20260716_Theme_Aware_Brush_Colors.md) | Added stable theme-aware palette persistence, retained-stroke recoloring, trackpad canvas navigation, and stylus-safe zoom behavior.
2026-07-16 | [Stroke Eraser](archive/20260716_Stroke_Eraser.md) | Added pressure-aware whole-stroke erasing with continuous swept hit-testing, independent tool sizing, and background-safe replay.
2026-07-16 | [Shape Tools](archive/20260716_Shape_Tools.md) | Added rectangle, ellipse, and rounded-rectangle tools with outline/solid modes, shared colors, stable controls, and whole-shape erasing.
