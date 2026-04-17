# Workspace Instructions

This workspace was initialized for ContextGo's built-in **Figma Closed Loop** assistant.

Use this file as the entry point for `code <-> Figma <-> code` work. Keep it short and route detailed material into `docs/`.

## Workspace Model

- `.contextgo/` is the installed workspace state for this package.
- Runtime-native skill directories are projections only.
- `docs/` is where Figma file ledgers, sync notes, handoff records, and drift reports should live.

## Context Routing

- Read `docs/README.md` for the workspace documentation map.
- Read `docs/files/README.md` for the closed-loop ledger of Figma files this workspace owns or syncs.
- Read `docs/sync/README.md` for design system rule sync and library sync notes.
- Read `docs/handoff/README.md` for implementation handoff records produced from Figma nodes.
- Read `docs/drift/README.md` for periodic drift reports between code and Figma.

## Project-Specific Instructions

Fill in:

- the Figma team and project this workspace targets
- which file keys are owned, which are read-only, and which are frozen
- who must approve Figma library publishes and destructive writes
- where DESIGN.md, tokens, and theme variables live in this repository
