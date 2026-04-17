---
name: campaign-variant-generator
description: Expand an existing campaign deliverable into a structured variant set across size, locale, audience, stage, channel, and theme axes.
compatibility:
  - 'Use when an approved deliverable needs to be expanded into a variant matrix for multi-region, multi-segment, or multi-stage publish.'
  - 'Use after the source deliverable has passed review so variant work does not amplify rework.'
---

# Campaign Variant Generator

Use this skill to expand an approved campaign deliverable into a structured variant set. The skill never invents new claims or visual identity; it only multiplies an approved source deliverable across the axes the campaign declares as in scope.

Read `../../references/variant-axes.md` before deciding the matrix. Read `../../references/platform-specs.md` and `../../references/channel-tone.md` for per-axis defaults.

## Use when

- An approved source deliverable (ad set, social batch, PDP block, KV pack) needs to ship across multiple locales, segments, stages, or placements.
- The campaign brief declares specific axes as in scope (locale, audience, stage, channel, theme overlay, stage-of-life).
- A previously generated variant set needs a refresh because the source changed or new axis values were added.

## Do not use when

- The source deliverable has not yet passed review (route back to `ad-creative-builder`, `social-asset-batch`, or `visual-copy-pairing`).
- The campaign brief has not declared axes (request the operator to declare scope first).
- The request introduces a new claim, price, date, or guarantee (route back to brief refinement).

## Failures to avoid

- multiplying all axes blindly so the variant count explodes
- producing locale variants that translate copy without honoring locale-specific compliance phrases
- producing audience variants whose value proposition contradicts the source deliverable
- producing channel variants that violate the platform spec or channel tone

## Workflow

### 1. Confirm inputs

Verify these inputs are present:

- approved source deliverable id and version
- campaign brief axis scope declaration
- locale list (if locale axis is in scope)
- audience segments (if audience axis is in scope)
- stage taxonomy (if stage axis is in scope)
- theme overlay reference (if theme axis is in scope)

If any input is missing, stop and request it.

### 2. Decide the variant matrix

Pick only the axes the campaign brief declared as in scope. Document the chosen axes in a matrix that lists:

- axis name
- axis values used
- expected variant count
- known exclusions (combinations that should not be produced)

### 3. Generate per-cell variants

For each cell in the matrix, produce:

- the source delta (what changes from the source deliverable)
- copy adjustments (locale, audience, stage tone)
- visual adjustments (size, theme overlay)
- compliance overlays where the locale or category requires them
- alt text adjustments where copy or visual changed

Reuse motifs and palette decisions from the source theme pack. Do not redesign visual identity.

### 4. Mark stale and refresh variants

If a previous variant set exists, compare the source version. For each existing variant:

- mark as current if the source version matches
- mark as stale if the source version moved
- emit a refresh action where stale

### 5. Apply per-vertical recipe

If the campaign matches a vertical in `../../references/vertical-recipes.md`, prefer the vertical variant breakdown over a generic matrix.

### 6. Write back to the workspace

When a workspace is linked, write the variant set into:

- `docs/campaigns/<campaign-id>/variants/matrix.md`
- `docs/campaigns/<campaign-id>/variants/<axis-cell-id>.md`

Stamp every file with the source deliverable version, brand context version, and theme pack version.

### 7. Flag review gates

End with explicit review gates:

- locale variants needing native-speaker review
- compliance overlays needing legal review
- variants whose source delta exceeds the source deliverable's intent

## Output format

Return:

### 1. Inputs confirmed

- source deliverable id and version
- axis scope declaration

### 2. Variant matrix

- chosen axes
- axis values
- exclusions
- expected variant count

### 3. Per-cell variants

- source delta
- copy adjustments
- visual adjustments
- compliance overlays
- alt text adjustments

### 4. Stale and refresh report

- current variants
- stale variants
- refresh actions

### 5. Workspace write-back plan

- the files to write or update
- the diff or summary for each file

### 6. Review gates

- locale variants needing native review
- compliance overlays needing legal review
- variants exceeding source intent

## Use together with

- `marketing-context-normalizer`
- `brand-theme-pack`
- `ad-creative-builder`
- `social-asset-batch`
- `visual-copy-pairing`
