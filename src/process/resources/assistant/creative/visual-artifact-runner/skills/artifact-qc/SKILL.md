---
name: artifact-qc
description: Run quality checks on a produced visual artifact, generate the build note, asset inventory, and failure-page list, and surface any theme drift.
compatibility:
  - 'Works best after an artifact has already been produced by a generation skill.'
  - 'Can also run as a standalone sweep against existing workspace artifacts.'
---

# Artifact QC

Use this skill to enforce visual artifact quality checks on a produced or
existing artifact and to keep build notes, asset inventories, and failure logs
up to date.

Read `../../docs/quality-checks.md` and `../../docs/export-modes.md` before
running.

## Use when

- A generation skill has just produced an artifact and needs its QC pass.
- A scheduled sweep checks workspace artifacts for theme drift or recipe rot.
- The user explicitly asks for an artifact-level audit.

## Do not use when

- The artifact has not been produced yet (run a generation skill first).
- The user only wants stylistic feedback rather than structural QC (use the
  appropriate design-direction skill instead).

## Workflow

### 1. Inspect the artifact

Confirm that the artifact file exists in the expected location, opens at the
expected size, and matches the declared recipe and theme.

### 2. Run pre-export checks

If the artifact spec is still in flight, run the pre-export check list from
`../../docs/quality-checks.md`. Stop at the first `block` failure and return
the failure list.

### 3. Run post-export checks

Once the artifact file exists:

- regenerate `build-notes.md` from the current spec
- refresh `assets.json` with the final asset inventory
- update `failures.json` with the page or slide level failure list
- check the artifact against the canonical theme catalog and recipe catalog
  for drift

### 4. Report

Return a concise QC report that includes:

- the artifact id, recipe, theme, and export mode
- any `block` failures (must be resolved before the artifact ships)
- any `warn` findings (recorded in `build-notes.md`)
- any theme or recipe drift findings

## Output

- updated `build-notes.md`, `assets.json`, and `failures.json`
- a QC report that lists block failures, warnings, and drift findings
