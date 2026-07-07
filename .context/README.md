# Context Management System

This directory is the persistent project memory and governance layer for PromptSketch.

## Files

- `README.md`: Context directory rules and onboarding notes for AI agents.
- `RAW_REQUIREMENTS.md`: User-owned raw ideas, feature requests, and product intent.
- `SPEC.md`: Refined source of truth for requirements, constraints, and technical choices.
- `ROADMAP.md`: Milestones and finalized decision log.
- `ACTIVE_TASK.md`: Current execution focus. Managed by the task workflow and not created during initial setup.

## Governance

1. Use the nearest `.context/` directory when working in this repository.
2. Read this file first, then open other context files only as needed.
3. Keep `SPEC.md` focused on what the product must do and why.
4. Keep implementation plans, experiments, and task-local notes in `ACTIVE_TASK.md` once a task is started.
5. Do not overwrite existing context files during sync. These files are user-owned.

