---
name: ad-creative-builder
description: Generate paid-ad creative variants (banner, KV, hero) sized to platform specs from the brand theme pack and campaign brief.
compatibility:
  - 'Use when the operator needs paid-ad units, banners, KVs, or hero creatives sized for specific platforms.'
  - 'Use after brand-theme-pack so palette, typography, and motif decisions stay consistent across the batch.'
---

# Ad Creative Builder

Use this skill to generate paid-ad creative variants (banner, KV, hero, in-stream) sized to platform specs. The skill consumes the brand theme pack and a campaign brief and produces a structured variant set that downstream review and handoff can act on.

Read `../../references/platform-specs.md` and `../../references/channel-tone.md` before producing variants. Read `../../references/variant-axes.md` before deciding the variant matrix. Read `../../references/vertical-recipes.md` if the campaign matches a known vertical.

## Use when

- The operator needs paid-ad units for Meta, TikTok, LinkedIn, X, or YouTube.
- The operator needs hero KVs or campaign banners that follow the brand theme pack.
- The operator needs a multi-platform ad batch where each placement must match its platform spec.

## Do not use when

- The brand context or theme pack is not yet ready (route to `marketing-context-normalizer` then `brand-theme-pack`).
- The request is for organic social content (route to `social-asset-batch`).
- The request is for visual + copy pairing as a structured deliverable (route to `visual-copy-pairing`).
- The request is for product UI mocks or screens (route to `Design Director`).
- The request is for a deck or pitch (route to `Morph PPT`).

## Failures to avoid

- producing creatives that ignore the platform spec (wrong aspect ratio, copy length, safe zone)
- mixing themes from multiple theme packs in one batch
- inventing claims, prices, dates, or guarantees not in the campaign brief
- producing identical copy across channels instead of honoring per-channel tone
- skipping compliance overlays for regulated categories

## Workflow

### 1. Confirm inputs

Verify these inputs are present:

- normalized brand context
- brand theme pack id and version
- campaign brief (objective, audience, value proposition, mandatory phrases, banned terms, CTA, claims with proof)
- target channels and placements
- locale list

If any input is missing, stop and request it. Never invent claims, prices, or dates.

### 2. Decide the variant matrix

Use `../../references/variant-axes.md` to pick which axes are in scope. Typical paid-ad axes:

- size (per-placement aspect ratio)
- channel (per-placement copy + tone)
- locale (per-locale copy + compliance)
- audience or stage (only when the brief declares them in scope)

Document the chosen axes. Do not multiply all axes blindly.

### 3. Plan per-channel placements

For each channel, look up the spec from `../../references/platform-specs.md` and the tone from `../../references/channel-tone.md`. Produce a placement plan that lists:

- aspect ratio
- safe zone
- max headline / body / CTA length
- tone summary
- compliance overlays for regulated categories

### 4. Generate creative variants

For each placement, produce:

- a creative concept (one-line hook + visual idea grounded in the theme pack motifs)
- headline copy within the platform limit
- body copy within the platform limit
- CTA from the supported list
- background / hero direction referencing the theme pack palette and motif slots
- alt text for accessibility

### 5. Apply per-vertical recipe

If the campaign matches a vertical in `../../references/vertical-recipes.md`, prefer the vertical recipe surfaces and variant breakdowns over generic asset planning.

### 6. Write back to the workspace

When a workspace is linked, write the batch into:

- `docs/campaigns/<campaign-id>/ad-creative/matrix.md`
- `docs/campaigns/<campaign-id>/ad-creative/<placement-id>.md` (one per placement)

Stamp every file with the brand context version, theme pack version, and campaign brief version.

### 7. Flag review gates

End with explicit review gates:

- claims requiring proof from `docs/brand/`
- regulated-category disclaimers requiring legal review
- placeholder values (price, date, venue, guarantee) requiring operator confirmation

## Output format

Return:

### 1. Inputs confirmed

- brand context version, theme pack version, campaign brief version

### 2. Variant matrix

- chosen axes
- placement list

### 3. Placement plan

- per-placement spec and tone summary

### 4. Creative variants

- per-placement creative concept, headline, body, CTA, visual direction, alt text

### 5. Workspace write-back plan

- the files to write or update
- the diff or summary for each file

### 6. Review gates

- claims needing proof
- compliance overlays needing legal review
- placeholders needing confirmation

## Use together with

- `marketing-context-normalizer`
- `brand-theme-pack`
- `social-asset-batch`
- `visual-copy-pairing`
- `campaign-variant-generator`
