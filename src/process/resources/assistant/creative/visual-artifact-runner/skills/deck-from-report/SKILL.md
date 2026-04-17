---
name: deck-from-report
description: Distill a long-form report into a summary deck with section-aware extraction, a chosen layout recipe, an applied theme, and reproducible build outputs.
compatibility:
  - 'Works best when the input is a structured report with headings, paragraphs, and embedded tables.'
  - 'Requires the workspace to expose a writable build directory for outputs.'
---

# Deck From Report

Use this skill when the user provides a long-form report or markdown document
and wants a summary deck.

Read `../../docs/input-contracts.md`, `../../docs/layout-recipes.md`, and
`../../docs/quality-checks.md` before drafting.

## Use when

- The input is a long-form report or structured markdown.
- The expected output is a presentation deck distilled from that report.
- The team wants citation-aware section coverage.

## Do not use when

- The input is a short brief (use `deck-from-brief`).
- The input is a PDF document (use `pdf-to-deck`).
- The user wants a flat handout (use the PDF or infographic recipes).

## Workflow

### 1. Extract the report skeleton

Identify the executive thesis, the 3 to 7 most load-bearing sections, the data
tables worth visualizing, and the quotes worth surfacing as callouts.

### 2. Pick the recipe

Default to `deck.report-summary`. Switch to `deck.exec-summary` when the user
asks for a 5 to 8 slide condensed deck. Record the rejected alternatives.

### 3. Apply the theme

Resolve all theme tokens before drafting slide content. Honor any theme override
the user provides.

### 4. Choose the export mode

Default to `pptx-static`. Use `pptx-morph` when the report contains narrative
arcs that materially benefit from Morph transitions. Delegate Morph builds to
`morph-ppt` per `../../docs/morph-integration.md`.

### 5. Produce the artifact

- generate the slide flow with section attribution back to the source
- run pre-export QC
- write the export file plus `build-notes.md`, `assets.json`, and `failures.json`
- preserve traceability between each slide and the report section that produced it

## Output

- a deck artifact in the requested mode
- a build note that records the chosen recipe, theme, mode, and section
  attribution
- an asset inventory and a failure list
