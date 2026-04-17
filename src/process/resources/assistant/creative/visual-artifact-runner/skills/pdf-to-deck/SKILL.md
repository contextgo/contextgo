---
name: pdf-to-deck
description: Convert a PDF input into a deck artifact, choosing between summary distillation and visual reconstruction with explicit traceability and QC.
compatibility:
  - 'Works best when the PDF either contains machine-readable text or a clearly visual layout.'
  - 'Requires the workspace to expose a writable build directory for outputs.'
---

# PDF To Deck

Use this skill when the user uploads a PDF and wants a deck artifact derived
from it.

Read `../../docs/input-contracts.md`, `../../docs/quality-checks.md`, and
`../../docs/morph-integration.md` before executing.

## Use when

- The input is a binary PDF document.
- The expected output is a deck either summarizing or visually reconstructing
  the source.

## Do not use when

- The input is plain markdown or a structured report (use `deck-from-report`).
- The user only wants a textual extract without a deck output.

## Workflow

### 1. Classify the PDF

Inspect the PDF before extracting content. Decide between:

- **summary distillation** for structured PDFs with machine-readable text where
  the user wants a condensed or differently-shaped deck
- **visual reconstruction** for visually dense PDFs that must keep their
  original layout fidelity

Record the classification and the reason in the build note.

### 2. Extract content

For summary distillation, extract section headings, body text, callouts, and
key tables. Preserve page citations so the deck can reference its source.

For visual reconstruction, capture page snapshots and structural metadata
sufficient to rebuild the layout in deck form.

### 3. Pick the recipe and theme

Default to `deck.report-summary` for distillation. For reconstruction, choose a
recipe that respects the original page sectioning and apply a theme close to the
source palette unless the user requests a re-skin.

### 4. Choose the export mode

Default to `pptx-static`. Use `pptx-morph` only when narrative motion adds
explanatory value over the original PDF.

### 5. Produce the artifact

- run pre-export QC, paying special attention to font fallback and image
  resolution
- write the export file plus `build-notes.md`, `assets.json`, and
  `failures.json`
- include page citations in the build note

## Output

- a deck artifact in the requested mode
- a build note that records the classification decision, recipe, theme, and
  page citations
- an asset inventory and a failure list
