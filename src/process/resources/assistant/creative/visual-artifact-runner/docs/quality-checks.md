# Quality Checks

The runner enforces guardrails before and after export. These checks generate
the `failures.json` entries listed in `export-modes.md`.

## Pre-Export Checks

Run before any export attempt:

- **font availability** - every requested font must resolve, or the runner falls
  back to a documented substitute
- **image availability** - every referenced image, chart, or icon must exist
  and be within the configured resolution range
- **chart overflow** - charts must fit inside their slot without truncation
- **page margin compliance** - content must respect the recipe margin tokens
- **heading hierarchy** - heading levels must form a valid tree (no skipped
  levels, no duplicate H1)
- **theme token coverage** - every theme token referenced by the recipe must be
  resolved, with no `undefined` lookups

If any pre-export check fails, the runner stops and emits a failure list rather
than producing a broken export.

## Post-Export Checks

Run after the export file is written:

- generate `build-notes.md` with input shape, recipe id, theme id, mode, key
  decisions, and any QC warnings
- generate `assets.json` with the final asset inventory
- generate `failures.json` with the page or slide level failure list (empty if
  all pages passed)
- verify that the file opens at the expected size and slide / page count

## PDF Routing Rule

When the input is a PDF, the runner must classify the source before extraction:

- **summary distillation** when the PDF is structured, has machine-readable
  text, and the user wants a shorter or differently-shaped artifact
- **visual reconstruction** when the PDF is mostly visual, requires layout
  preservation, or the user wants a high-fidelity remake

The classification decision must be written into `build-notes.md` so a later
reviewer can see why one path was taken over the other.

## Theme Drift Detection

Periodic QC sweeps should:

- compare every artifact in the workspace against the canonical theme catalog
- flag artifacts whose theme id has been removed or changed
- flag artifacts whose recipe is older than the current recipe catalog version

Theme drift findings live in the QC report rather than blocking the existing
artifact.

## Severity Levels

- `block` - export is stopped, file is not produced
- `warn` - export proceeds, but the issue is recorded in `build-notes.md`
- `info` - logged for traceability without surfacing to the user
