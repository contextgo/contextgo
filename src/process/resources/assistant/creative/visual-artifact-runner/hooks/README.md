# Visual Artifact Runner Hooks

This directory carries the package-owned QC hook registry stub.

The hooks declared here are surface-level placeholders that ContextGo
materializes into the workspace at `.contextgo/hooks/` and selects through
`.contextgo/hooks.json`.

## Default Hooks

- `pre:export:font-availability` - block export when a referenced font cannot
  resolve and no documented substitute exists
- `pre:export:image-availability` - block export when a referenced image,
  chart, or icon is missing
- `pre:export:layout-overflow` - block export when a chart or block overflows
  its slot or violates the recipe margin
- `pre:export:heading-hierarchy` - block export when heading levels are not a
  valid tree
- `pre:export:theme-token-coverage` - block export when a theme token cannot be
  resolved
- `post:export:build-notes` - emit `build-notes.md` covering input shape,
  recipe, theme, mode, and key decisions
- `post:export:asset-inventory` - emit `assets.json` covering every embedded
  image, chart, and font
- `post:export:failure-pages` - emit `failures.json` covering any pages or
  slides that did not pass QC
- `post:export:pdf-routing` - record the PDF classification decision
  (summary distillation versus visual reconstruction)

These ids are used by `.contextgo/hooks.json` to enable or disable individual
hooks per workspace. The package treats hook payloads as stubs until the
runtime QC pipeline lands; the contract is the hook id and its trigger phase.

## Why This Exists

The Visual Artifact Runner package owns artifact-level QC. The hook registry
stub gives ContextGo a stable surface to attach the QC pipeline to without
inventing a new product surface for each new generation skill.
