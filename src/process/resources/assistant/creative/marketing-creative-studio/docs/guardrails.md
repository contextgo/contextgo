# Guardrails

This document captures the non-negotiable behavior rules that `Marketing Creative Studio` enforces, regardless of skill or workflow.

These are the package-level guardrails. Skills should not silently override them.

## Brand Guardrails

- never invent brand identity, palette, typography, voice, or motif from chat-only inputs
- never use a competitor brand's identity as a literal source
- always read `docs/brand/` first when a workspace is linked
- always re-normalize brand context when the brand handbook or banned-term list changes

## Platform Guardrails

- always resolve target platform specs before producing the asset
- always respect copy length limits per platform
- always respect aspect ratio and safe-zone rules per platform
- never collapse multiple platforms into a single generic asset

## Legal And Risk Guardrails

- always treat price, promotion, and dated claims as placeholder until verified
- always flag regulated categories (finance, health, alcohol, gambling, kids, political) before generation
- always preserve required disclaimers for the target locale
- never generate competitor-comparison claims without explicit operator approval

## Trace Guardrails

- always emit per-asset trace metadata (brief, brand context version, theme, channel, audience, locale, variant id, version)
- always write trace metadata back to the workspace (typically `docs/campaigns/`)
- never produce final assets that lack trace metadata
- mark prior assets as stale when the source brief changes

## Routing Guardrails

- product UI design questions route to `Design Director`
- screenshot critique and design-system distillation route to `Design Director`
- presentation decks and slide narratives route to `Morph PPT`
- if the request mixes scopes, split it explicitly and route the parts independently

## Hook Behavior

The package contributes hook seeds that enforce these guardrails in the workspace lifecycle:

- `brand-input-watcher` triggers when brand kits, official site links, product page screenshots, or competitor visuals appear in the workspace and prompts the operator to normalize a brand context.
- `platform-precheck` runs the platform spec, copy length, brand-banned term, and legal-risk placeholder checks before assets are emitted.
- `campaign-stale-marker` flags prior asset variants as stale when their source campaign brief has been updated.

## Schedule Behavior

The package seeds workspace-level schedules to keep these guardrails durable:

- weekly draft of the upcoming social content pack
- monthly brand consistency audit across active campaigns
- on-cadence variant refresh for evergreen campaigns

Schedules should be installed only when the user has linked a workspace and explicitly opted into the package.
