---
name: deck-from-brief
description: Turn a structured brief into a deck artifact with normalized inputs, a chosen layout recipe, an applied theme, and a build note plus QC results.
compatibility:
  - 'Works best when the user provides a brief with topic, audience, goal, key messages, and tone.'
  - 'Requires the workspace to expose a writable build directory for outputs.'
---

# Deck From Brief

Use this skill when the user has a brief or short structured planning input and
wants a deck-style visual artifact.

Read `../../docs/input-contracts.md`, `../../docs/layout-recipes.md`, and
`../../docs/quality-checks.md` before drafting.

## Use when

- The input is a brief with topic, audience, goal, and key messages.
- The expected output is a presentation deck.
- The team wants the output reproducible from the input.

## Do not use when

- The input is a long-form report (use `deck-from-report`).
- The input is a PDF document (use `pdf-to-deck`).
- The user only wants an infographic (use `report-to-infographic`).

## Workflow

### 1. Normalize the brief

Confirm the brief contains the required fields. If any required field is missing,
state which field is missing and ask before proceeding.

### 2. Pick the recipe

Score the available `deck.*` recipes. Choose the smallest recipe that still
expresses every key message. Record the rejected alternatives in the build note.

### 3. Apply the theme

Select a theme id from the catalog or accept an inline theme override. Resolve
all theme tokens before drafting any slide content.

### 4. Choose the export mode

Default to `pptx-static`. Switch to `pptx-morph` when the brief explicitly asks
for narrative motion or when the visual story benefits from Morph transitions.
For `pptx-morph`, hand off to `morph-ppt` per `../../docs/morph-integration.md`.

### 5. Produce the artifact

- generate the slide structure based on the recipe
- run pre-export QC from `../../docs/quality-checks.md`
- write the export file plus `build-notes.md`, `assets.json`, and `failures.json`

## Output

- a deck artifact in the requested mode
- a build note that includes input shape, recipe id, theme id, mode, and key
  decisions
- an asset inventory and a failure list (empty if all checks passed)
