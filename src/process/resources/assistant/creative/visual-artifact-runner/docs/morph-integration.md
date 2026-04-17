# Morph Integration

This document defines the boundary between **Visual Artifact Runner** and the
existing **Morph PPT** package.

## Why Two Packages

The two packages exist at different layers:

- **Visual Artifact Runner** owns input normalization, layout recipe selection,
  theme application, multi-mode export, and artifact-level QC across Deck /
  PDF / Infographic / handout outputs.
- **Morph PPT** owns Morph animation strategy, deck narrative enhancement, and
  the reproducible PPT build flow that drives those animations.

Without this split, the deck execution layer would either lose Morph narrative
discipline or pull every PDF and infographic concern into a single PPT-shaped
package. Neither option scales.

## Boundary Contract

- `visual-artifact-runner` is the **default** entry point for any document-style
  visual artifact request
- when the request requires Morph animation strategy or a reproducible PPT
  build flow, `visual-artifact-runner` selects the `pptx-morph` export mode and
  delegates the deck build to `morph-ppt`
- `morph-ppt` continues to own its own SKILL surface, animation rules, and
  build-script generation; this package does not duplicate those
- this package does not modify the `morph-ppt` outward contract

## Handoff Payload

When delegating to `morph-ppt`, the runner provides:

- the normalized brief or report payload
- the chosen layout recipe id
- the resolved theme spec
- explicit Morph permissions (which sections may use Morph, which must stay
  static)
- the build directory and asset inventory

The runner consumes back:

- the produced `.pptx` file
- the `morph-ppt` build note and asset list
- any failure pages reported by `morph-ppt`

The runner then merges these into its own build note and QC artifacts.

## Anti-Patterns

- duplicating Morph animation logic inside this package
- bypassing `morph-ppt` for Morph-animated decks just because the input shape
  arrived through this package
- letting `morph-ppt` absorb non-deck artifact types
- treating `morph-ppt` as a competitor; it is a backend collaborator for the
  `pptx-morph` export mode

## Long-Term Direction

`morph-ppt` and `visual-artifact-runner` should remain distinct packages. If
either package starts pulling responsibilities from the other, raise an issue
to revisit the boundary instead of silently collapsing the layers.
