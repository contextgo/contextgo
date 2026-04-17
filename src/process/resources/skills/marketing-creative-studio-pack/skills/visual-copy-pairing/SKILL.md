---
name: visual-copy-pairing
description: Pair visual direction with copy decks so headlines, body, CTA, and hero imagery resolve as one structured deliverable.
compatibility:
  - 'Use when the operator needs a structured visual + copy deliverable that is not a single ad placement (PDP, email, one-pager, KV pack).'
  - 'Use after brand-theme-pack so the deliverable shares the theme pack visual system.'
---

# Visual Copy Pairing

Use this skill to produce structured deliverables where visual direction and copy must be decided together: PDP modules, email blocks, one-pagers, hero KV packs, sales sheets, event signage. Each deliverable is a stable, consumable artifact rather than a per-channel post.

Read `../../references/channel-tone.md` for tone guidance. Read `../../references/vertical-recipes.md` if the deliverable matches a known vertical surface.

## Use when

- The deliverable couples visual direction and copy into one artifact (PDP block, email block, one-pager, hero KV pack).
- Headlines, body, CTA, and hero imagery must be decided as one set, not separately.
- The deliverable is a campaign hub artifact other surfaces will reference.

## Do not use when

- The brand context or theme pack is not yet ready (route to `marketing-context-normalizer` then `brand-theme-pack`).
- The request is a paid-ad placement (route to `ad-creative-builder`).
- The request is an organic social post batch (route to `social-asset-batch`).
- The request is product UI mocks (route to `Design Director`).
- The request is a slide deck (route to `Morph PPT`).

## Failures to avoid

- writing copy and visual direction in separate passes that contradict each other
- letting the visual hero override a claim or proof point promised in copy
- skipping per-module hierarchy so the artifact reads flat
- inventing claims, prices, or proof points not in the brief or `docs/brand/`

## Workflow

### 1. Confirm inputs

Verify these inputs are present:

- normalized brand context
- brand theme pack id and version
- brief (objective, audience, claims with proof, mandatory phrases, banned terms, primary CTA, secondary CTA)
- target surface type (PDP, email, one-pager, hero KV pack, signage)

If any input is missing, stop and request it.

### 2. Decide module structure

Pick the module sequence based on surface type:

- PDP: hero, primary claim block, proof block, feature block, comparison block, CTA block
- email: header, primary claim block, proof block, secondary CTA block
- one-pager: hero, value proposition, three proof points, CTA, footer
- hero KV pack: master hero, supporting cuts at additional aspects
- signage: hero, primary claim, wayfinding, sponsor or partner block

Document the chosen module sequence.

### 3. Pair visual and copy per module

For each module, decide together:

- claim copy
- supporting body
- proof reference (cite source from `docs/brand/`)
- hero imagery direction grounded in the theme pack motifs
- composition rule (anchor, hierarchy, safe zone)
- CTA where present

### 4. Resolve hierarchy and flow

Across modules, decide:

- which module owns the dominant claim
- progressive disclosure order
- single primary CTA across the artifact

### 5. Apply per-vertical recipe

If the deliverable matches a vertical in `../../references/vertical-recipes.md`, prefer the vertical recipe surfaces and module breakdowns.

### 6. Write back to the workspace

When a workspace is linked, write the deliverable into:

- `docs/campaigns/<campaign-id>/visual-copy/<deliverable-id>/structure.md`
- `docs/campaigns/<campaign-id>/visual-copy/<deliverable-id>/<module-id>.md`

Stamp every file with the brand context version, theme pack version, and brief version.

### 7. Flag review gates

End with explicit review gates:

- claims needing proof
- compliance overlays for regulated categories
- placeholder values needing confirmation

## Output format

Return:

### 1. Inputs confirmed

- brand context version, theme pack version, brief version

### 2. Module structure

- module sequence

### 3. Per-module pairing

- claim, body, proof reference, hero direction, composition, CTA

### 4. Hierarchy and flow

- dominant claim
- disclosure order
- primary CTA

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
- `ad-creative-builder`
- `social-asset-batch`
- `campaign-variant-generator`
