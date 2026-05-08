---
name: hyperframes-qc
description: Validate HyperFrames video outputs, render manifests, source files, dimensions, duration, frame readability, subtitle timing, asset references, audio presence, rights notes, and rerender readiness.
---

# HyperFrames QC

Use before delivering any HyperFrames render.

## Checks

Manifest:

- manifest exists
- project path exists
- render command is recorded
- output path exists
- dimensions, fps, and duration are recorded
- assets and source notes are listed

File:

- output is non-empty
- extension matches requested format
- output is under `docs/videos/renders/`
- previous versions were not overwritten accidentally

Visual:

- required text is present and legible
- subtitles fit and stay on screen long enough
- safe margins are respected
- scene timing matches script
- transitions do not obscure key content
- charts have readable labels and correct units

Media:

- local assets exist
- remote references are intentional
- audio/subtitles are synchronized when present
- source lineage is preserved for generated media
- font and music rights notes are recorded when relevant

## Verdicts

- `pass`: ready to deliver.
- `pass-with-notes`: usable with caveats.
- `rerender-required`: source/render must be fixed and rendered again.
- `blocked`: missing file, missing manifest, missing dependency, rights issue, or broken source assets.

## Report

Write QC reports to `docs/videos/qc/<project-id>.md`. Include task summary, checked files, verdict, and rerender instructions.
