# Brand Inputs

This document defines what counts as a brand input for `Marketing Creative Studio`, how to normalize it, and where to store it.

A brand context must exist before the package produces any final asset. If a request arrives without one, build a normalized brand context first and treat the rest of the work as blocked until that context is in place.

## What Counts As A Brand Input

Treat the following as brand inputs the package should ingest:

- official brand handbook PDFs, brand-system pages, or design-token exports
- official site or product-page URLs
- representative product or hero screenshots
- competitor or reference assets explicitly used as direction
- prior published campaign assets that should remain consistent
- channel handle screenshots (Instagram grid, X profile, YouTube banner)
- legal-safe term lists, banned-term lists, mandatory disclaimers

Do not treat the following as authoritative brand input:

- chat-only adjectives like "make it premium"
- mood boards without a stated goal
- a single competitor screenshot used as a copy target
- references the user has not confirmed they own or are licensed to reuse

## Brand Context Normalization

The package's first responsibility on any new campaign is to produce a normalized brand context object. The structure should be stable across campaigns:

- identity
  - brand name, voice, tone, personality dimensions
  - primary and secondary palette with semantic roles
  - typography stack with role mapping
  - logo lockups, clearspace rules, do-not-do rules
- channel preferences
  - ranked list of priority channels
  - per-channel formatting expectations and locale defaults
- copy rules
  - voice description, vocabulary preferences, banned terms, mandatory phrases
  - localization expectations and tone mapping per locale
- visual primitives
  - photographic vs illustrative direction
  - graphic motif library and usage rules
  - imagery do-not-do rules

## Storage

When a workspace is linked, normalized brand context belongs in the workspace docs structure:

```text
docs/brand/
  README.md
  context.md           - normalized brand context
  banned-terms.md      - per-brand or per-locale exclusion list
  channel-preferences.md
  visual-primitives.md
```

Skills should treat `docs/brand/` as the source of truth and refuse to invent brand identity from chat-only inputs.

## Refresh Triggers

Re-normalize brand context when any of the following occur:

- a new official brand handbook is dropped into the workspace
- a competitor reference is replaced with a new one
- a major channel mix change (for example adding a new platform)
- legal-safe term lists are updated

The `brand-input-watcher` hook surfaces these triggers automatically when supported workspace files change.
