# Drift Model

The Figma Closed Loop package treats drift between code-side and Figma-side design systems as a first-class object, not a vague feeling.

## What Counts As Drift

Drift is any structural mismatch between the code-side source of truth and the Figma-side source of truth, across these surfaces:

- **tokens** — color, spacing, radius, typography, motion durations, elevation
- **components** — anatomy, variants, states, slots, default props
- **library version** — published library version vs the version actually consumed in code
- **screens** — page-level structure, key flows, and major frame layouts

## Direction Of Drift

Each drift item must be tagged with a direction:

- `code-only` — exists in code but not in Figma
- `figma-only` — exists in Figma but not in code
- `divergent` — exists on both sides but with conflicting definition
- `version-skew` — same definition, different published or consumed version

`code-only` and `figma-only` items are usually intentional or in-flight changes. `divergent` and `version-skew` items are the high-risk drift category.

## Severity

Three levels:

- `cosmetic` — small visual differences that do not break component contracts (rounded corner of 8 vs 6)
- `contract` — variant, slot, prop, or state divergences that break consumer expectations
- `system` — token-level or library-version divergences that cascade through many components or screens

## Remediation Tracks

Each item should land in one of three tracks:

- **auto-syncable** — safe to project from code to Figma or vice versa with no human judgement
- **review-required** — needs design or engineering judgement before sync
- **frozen** — known divergence that is intentional and must be left alone

`figma-drift-audit` should never silently move an item from `frozen` back into `auto-syncable`.

## Output Expectations

A drift audit run should produce:

- a structured table of drift items with surface, direction, severity, and track
- a remediation plan that lists auto-syncable items first, review-required items next, and frozen items last
- explicit links from each remediation item to the Figma file key, node id, and code path involved
- a summary that explains which items, if not addressed, are most likely to cause user-visible inconsistencies
