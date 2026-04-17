# Campaign Workflows

This document describes the end-to-end campaign workflows that `Marketing Creative Studio` should follow.

A workflow always passes through the same five layers from `docs/design.md`:

1. brand context
2. channel constraints
3. visual recipe
4. variant set
5. trace metadata

Skipping or reordering layers is treated as a defect.

## Workflow A: Single Campaign Brief To Multi-Channel Pack

Use when a marketer drops a single campaign brief and expects assets across multiple channels.

1. **Intake** - capture campaign goal, audience, time window, success metric, and the channels in scope.
2. **Brand Context Resolution** - reuse the workspace brand context, or invoke `marketing-context-normalizer` if missing.
3. **Channel Constraint Map** - resolve platform spec, copy length, locale variants, and legal-safe placeholders for every target channel.
4. **Visual Recipe Selection** - pick the asset family per channel (ad creative, social asset, ecommerce KV, etc.) using `asset-recipes.md`.
5. **Visual + Copy Pairing** - run `visual-copy-pairing` so the visual treatment and the copy block fit together rather than being generated in isolation.
6. **Variant Generation** - call `campaign-variant-generator` to expand size, locale, and audience variants per recipe.
7. **Pre-publish Review** - apply `review-checklist.md` and the `platform-precheck` hook before delivery.
8. **Trace Write-back** - persist trace metadata so future asset refreshes can find the source brief.

## Workflow B: Brand Theme Refresh

Use when a brand changes seasonally, ships a campaign theme, or runs an event.

1. Refresh the brand context with the new theme overlay.
2. Use `brand-theme-pack` to define the theme deltas: palette adjustments, motif changes, tone adjustments.
3. Mark prior assets that depend on the previous theme as stale via `campaign-stale-marker`.
4. Re-run any active recurring campaigns through `campaign-variant-generator` with the new theme.

## Workflow C: Industry Vertical Recipe

Use when the request is anchored on a vertical (ecommerce launch, SaaS onboarding push, presales kit, event KV).

1. Look up the matching template in `industry-templates.md`.
2. Resolve brand context plus vertical-specific assumptions (for example ecommerce SKU set, SaaS pricing tier, presales target accounts).
3. Run the workflow with the vertical recipe instead of inventing a structure.

## Workflow D: Stale Asset Refresh

Triggered by the `campaign-stale-marker` hook or by manual review.

1. Compare the current source brief to the stored trace metadata for each asset.
2. For mismatched assets, either regenerate variants or mark them as decommissioned.
3. Update trace metadata so the workspace stays in a consistent state.

## Workflow E: Cross-Channel Consistency Audit (Phase 3)

Schedule-driven audit (monthly cadence by default).

1. Pull active campaign trace metadata from `docs/campaigns/`.
2. Compare brand and tone signals across channels.
3. Surface inconsistencies in a written report and propose corrective regeneration.
