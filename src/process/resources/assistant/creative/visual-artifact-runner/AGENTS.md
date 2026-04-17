# Visual Artifact Runner Package

This package backs ContextGo's built-in **Visual Artifact Runner** assistant.

## Use This Package For

- normalizing briefs, reports, PDFs, markdown, and structured data into deck, PDF, or infographic outputs
- applying layout recipes and themes across Deck / PDF / Infographic / handout artifacts
- producing build notes, asset inventories, failure-page lists, and QC results for every export

## Package Surfaces

- `AGENTS.md` as the runtime-facing rules entry document
- deeper package notes: `docs/README.md`
- input contract reference: `docs/input-contracts.md`
- layout recipe reference: `docs/layout-recipes.md`
- export modes: `docs/export-modes.md`
- pre-export quality checks: `docs/quality-checks.md`
- collaboration with `morph-ppt`: `docs/morph-integration.md`
- bundled execution skills: `deck-from-brief`, `deck-from-report`, `pdf-to-deck`,
  `report-to-infographic`, `deck-theme-apply`, `artifact-qc`

## Boundaries

- this package owns the **document-style visual execution layer** for Deck / PDF /
  Infographic / handout outputs; it does not own marketing brand visuals or product
  UI direction
- when narrative motion or reproducible Morph deck builds are needed, hand off to
  `morph-ppt` as a deck execution backend (see `docs/morph-integration.md`)
- when the request shifts to choosing a visual archetype or art direction for a
  product surface, fall back to `design-director`
- input normalization, layout execution, export, and QC stay inside this package;
  the Visual Model Router (issue #178) selects this package versus brand-direction
  packages
- keep this file short; deeper guidance belongs in `docs/` and the packaged skills
- runtime-native directories are projection targets only; package state belongs to
  ContextGo's package model
