# Figma Closed Loop Package Notes

This package contains ContextGo's built-in Figma round-trip assistant.

## Main Purpose

Figma Closed Loop exists to turn `code <-> Figma <-> code` into a real execution loop instead of leaving Figma as a one-way reference surface.

The package is optimized for:

- design system rules sync from project DESIGN.md, tokens, and theme variables
- component library sync from code-side component changes into Figma library files
- pushing code-side pages or screens into Figma as frame or screen drafts
- generating implementation suggestions or scoped code-change drafts from Figma nodes
- detecting and reporting drift between code-side and Figma-side design systems

## Package Surfaces

- `AGENTS.md`
  - runtime-facing rules entry document
- `docs/README.md` (this file)
  - package overview
- `docs/workflows.md`
  - the six bundled workflows and how they compose
- `docs/mcp-setup.md`
  - Figma MCP setup, permissions, and connectivity preconditions
- `docs/drift-model.md`
  - how the package classifies drift between code and Figma
- `docs/guardrails.md`
  - non-negotiable safety rules around Figma writes and library publish
- package root
  - `src/process/resources/assistant/design/figma-closed-loop`
- package-local skill source
  - `src/process/resources/assistant/design/figma-closed-loop/skills`

## Bundled Skills

- `figma-file-bootstrap`
- `figma-screen-generate`
- `figma-library-sync`
- `figma-design-system-rules-sync`
- `figma-implementation-handoff`
- `figma-drift-audit`

## Stable Package Behaviors

This package should continue to:

- treat Figma writes as auditable actions, never as silent side effects
- require explicit confirmation before any library version bump or library publish
- record file key, node id, code path, executor, and timestamp for every closed-loop action
- defer to `design-director` when the task is reference absorption, critique, or pure visual judgement
- stop and report if Figma MCP, file access, or write permission is missing

## Installation Surfaces

- `.contextgo/skills`
  - installs the bundled Figma round-trip skills declared by the package
- `.contextgo/commands.json`
  - seeded through the `figma-closed-loop` workspace automation profile
- `.contextgo/schedules.json`
  - seeded through the `figma-closed-loop` workspace automation profile (currently empty container, ready for drift report and library candidate watchers)
- `.contextgo/hooks.json`, `.contextgo/hooks/`
  - this package does not currently contribute package-specific hook seeds; recommended hook hooks are described in `docs/workflows.md` and may be wired in a follow-up phase
- runtime-native directories
  - only receive projected skills when the runtime needs its own native skill directory

## Authoring Rule

Keep runtime persona rules in `AGENTS.md`, package rationale in `docs/`, and executable behavior in `skills/`.
