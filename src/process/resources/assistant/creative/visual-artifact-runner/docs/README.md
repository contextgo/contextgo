# Visual Artifact Runner Package Notes

This package contains the assistant-facing entry for ContextGo's built-in
**Visual Artifact Runner** workflow. It unifies the document-style visual
execution layer across Deck / PDF / Infographic / handout outputs.

## Main Purpose

Visual Artifact Runner exists to stop document-style visual production from
being scattered across one-off assistants and ad-hoc workflows. The package
is optimized for:

- normalizing structured or semi-structured inputs into a usable artifact plan
- selecting the correct layout recipe for the target artifact type
- applying themes and visual templates consistently
- producing exports together with build notes, asset inventories, and QC results
- reusing `morph-ppt` as a deck execution backend when Morph narrative is needed

## Package Surfaces

- `AGENTS.md` - runtime-facing rules entry document
- `docs/README.md` - this file
- `docs/input-contracts.md` - what shape an input must have to enter the runner
- `docs/layout-recipes.md` - canonical layout recipes per artifact type
- `docs/export-modes.md` - supported export modes and target file types
- `docs/quality-checks.md` - guardrails enforced before and after export
- `docs/morph-integration.md` - boundary with `morph-ppt`
- package root - `src/process/resources/assistant/creative/visual-artifact-runner`
- skill source - `src/process/resources/assistant/creative/visual-artifact-runner/skills`
- bundled execution skills - `deck-from-brief`, `deck-from-report`, `pdf-to-deck`,
  `report-to-infographic`, `deck-theme-apply`, `artifact-qc`

## Stable Package Behaviors

This package should continue to:

- classify the artifact type before choosing a recipe
- separate input normalization, layout execution, theme application, and QC
- emit a build note, asset inventory, and failure-page list for every export
- prefer reusing existing themes and templates over inventing one-off styles
- delegate Morph narrative deck builds to `morph-ppt` instead of duplicating it

## Workspace Commands

This package seeds the following commands:

- `/deck-from-brief`
- `/deck-from-pdf`
- `/artifact-infographic`
- `/artifact-theme`
- `/artifact-qc`

## Workspace Schedules

This package seeds optional schedule containers for periodic artifact rebuilds
and QC sweeps. The container starts empty and is meant to be populated when a
recurring report source needs an automatic weekly deck or monthly handout.

## Installation Surfaces

- `.contextgo/skills` - installs the visual artifact execution skills
- `.contextgo/commands.json` - seeded through the `visual-artifact-runner`
  workspace automation profile
- `.contextgo/schedules.json` - seeded by ContextGo with the standard
  conversation schedule container for this package
- `.contextgo/hooks/` and `.contextgo/hooks.json` - package-owned QC hook
  registry stub for pre-export and post-export checks
- runtime-native directories - only receive projected skills when the runtime
  expects its own native skill directory

## Authoring Rule

Keep runtime persona rules in `AGENTS.md`, package-level notes in `docs/`, and
executable workflows in the packaged skills. Theme catalogs, recipe libraries,
and export mode definitions belong in `docs/` so that they remain product-owned
and not buried inside skill prompts.

## Migration Status

This package is a Phase 1 implementation. It currently covers:

- `brief -> deck`
- `report -> summary deck`
- `pdf -> summary deck`
- `markdown / structured -> infographic`
- theme application across deck and infographic outputs
- artifact QC with build-note generation

Phase 2 will deepen `morph-ppt` collaboration for animated deck variants and add
more export modes. Phase 3 will turn periodic rebuilds and audience variants
into first-class workflows.
