# Commands Surface

Use this document when the task touches command entry points, slash-command compatibility, or command migration.

## What Commands Mean Here

- Commands are a workspace automation surface managed by ContextGo.
- Installed command state lives in `.contextgo/commands.json`.
- For this harness, commands often preserve upstream ECC entry points while newer workflow behavior moves toward skills-first routing.

## Open This Doc When

- mapping a user-facing command to the underlying workflow
- deciding whether a new workflow should be a skill, a command, or both
- auditing compatibility with absorbed ECC command names
- removing or translating legacy command behaviors

## Authoring Guidance

- Prefer skills as the canonical reusable workflow surface.
- Keep commands as explicit entry points, shortcuts, or compatibility shims when they still add value.
- Do not treat a runtime-specific slash-command layout as the product boundary.
