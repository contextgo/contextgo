---
name: brand-theme-pack
description: Build a reusable brand theme pack from the normalized brand context so downstream creative skills share one visual system.
compatibility:
  - 'Use after marketing-context-normalizer when the workspace lacks a current brand theme pack.'
  - 'Use when a campaign theme overlay (seasonal, festival, partnership) needs to be applied as a delta on top of the base brand.'
---

# Brand Theme Pack

Use this skill to build a reusable brand theme pack. A brand theme pack is the single source of truth that downstream skills (`ad-creative-builder`, `social-asset-batch`, `visual-copy-pairing`, `campaign-variant-generator`) consume to keep visual decisions consistent.

Read `../../references/platform-specs.md`, `../../references/channel-tone.md`, and `../../references/variant-axes.md` before assembling the pack so the theme decisions match downstream consumers.

## Use when

- The workspace has a current normalized brand context but no theme pack yet.
- A campaign needs a seasonal, festival, partnership, or limited-time theme delta.
- Visual primitives in the brand context have changed and the previous theme pack is now out of date.
- Multiple campaigns need to share a single visual system across batches.

## Do not use when

- The brand context itself has not been normalized (route to `marketing-context-normalizer`).
- The request is for a single ad or social asset and no other skills will reuse the theme.
- The task is product UI theming or design-system tokens (route to `Design Director`).

## Failures to avoid

- redefining brand identity instead of building on the normalized brand context
- inventing palette, typography, or motif values not present in the brand context
- letting a campaign theme overlay overwrite the base brand identity instead of layering as a delta
- producing a theme pack that downstream skills cannot consume because sections are missing

## Workflow

### 1. Confirm the brand context input

Read the normalized brand context from `docs/brand/` (or from the operator-provided source). If the brand context is missing or stale, stop and route to `marketing-context-normalizer`.

### 2. Decide theme scope

Decide whether the pack is:

- a base theme (covers the brand long-term, expected to be the default for all campaigns)
- a campaign theme overlay (seasonal, festival, partnership, limited-time)

A campaign overlay must declare its base theme parent and only encode the delta from the base.

### 3. Assemble the theme primitives

Produce these stable sections, sourced from the brand context:

- palette tokens (semantic roles: primary, accent, surface, text, on-color, status)
- typography stack (display, headline, body, caption, monospace where relevant)
- motif library (shapes, textures, photographic style notes, illustration style notes)
- composition rules (grid, safe zones, hero anchor, hierarchy rules)
- treatment rules (effects, shadows, gradients, do-not-do treatments)

### 4. Map theme to channels

For each prioritized channel from the brand context, document:

- which palette roles dominate
- which typography roles are allowed at which size
- which motifs are channel-appropriate
- channel-specific compliance overlays

### 5. Write back to the workspace

When a workspace is linked, write the theme pack into:

- `docs/brand/themes/<theme-id>/theme.md`
- `docs/brand/themes/<theme-id>/palette.md`
- `docs/brand/themes/<theme-id>/typography.md`
- `docs/brand/themes/<theme-id>/motifs.md`
- `docs/brand/themes/<theme-id>/channel-mapping.md`

Stamp every file with the brand context version it was built from.

### 6. Surface unresolved gaps

End with an explicit list of:

- primitives that the brand context did not cover
- assumed values that need confirmation
- channels that need a real platform spec validation pass

## Output format

Return:

### 1. Theme scope

- base theme or overlay, with parent reference if overlay
- brand context version source

### 2. Theme primitives

- palette
- typography
- motifs
- composition rules
- treatment rules

### 3. Channel mapping

- per-channel palette, typography, motif, compliance overlay

### 4. Workspace write-back plan

- the files to write or update
- the diff or summary for each file

### 5. Unresolved gaps

- missing primitives
- assumed values
- channels needing spec validation

## Use together with

- `marketing-context-normalizer`
- `ad-creative-builder`
- `social-asset-batch`
- `visual-copy-pairing`
- `campaign-variant-generator`
