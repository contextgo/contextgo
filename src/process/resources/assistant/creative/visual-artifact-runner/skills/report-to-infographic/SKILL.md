---
name: report-to-infographic
description: Turn a report or structured data input into an infographic artifact, choosing the right infographic recipe and chart family per data shape.
compatibility:
  - 'Works best when the input includes structured data or clearly comparable claims.'
  - 'Requires the workspace to expose a writable build directory for outputs.'
---

# Report To Infographic

Use this skill when the user provides a report, markdown summary, or structured
data and wants an infographic instead of a deck.

Read `../../docs/input-contracts.md`, `../../docs/layout-recipes.md`, and
`../../docs/quality-checks.md` before drafting.

## Use when

- The input is a report, markdown document, or structured data table.
- The expected output is a single-frame or scrollable infographic.

## Do not use when

- The user wants a multi-slide deck (use `deck-from-report` or `deck-from-brief`).
- The user wants a multi-page handout (use a PDF recipe).

## Workflow

### 1. Identify the data shape

Detect the dominant shape: time series, ranking, matrix, distribution, or
process. The shape constrains the chart family and the recipe.

### 2. Pick the recipe

Choose from `infographic.timeline`, `infographic.comparison`,
`infographic.process`, or `infographic.dashboard`. Record the rejected
alternatives.

### 3. Apply the theme

Resolve theme tokens before drafting any block. Honor any theme override the
user provides. Keep the chart palette inside the theme's allowed range.

### 4. Choose the export mode

Default to the `infographic` mode. Optionally also produce a `pdf-handout` for
print-friendly distribution.

### 5. Produce the artifact

- generate the infographic structure based on the recipe and the resolved data
- run pre-export QC, paying special attention to chart overflow and label
  legibility
- write the export file plus `build-notes.md`, `assets.json`, and
  `failures.json`

## Output

- an infographic artifact in the requested mode
- a build note that records the data shape, recipe, theme, and any chart
  decisions
- an asset inventory and a failure list
