# Publish Object Catalog Phase 1 Design

**Date:** 2026-04-14
**Status:** Approved for implementation

## Goal

Implement the first deliverable slice for Batch 1 of the Agent-first IM publication epic:

- `#119` object discovery fallback unification
- `#140` stable display identity / display profile backfill

This slice should make the publication UI prefer a formal publish-object catalog instead of ad-hoc string guesses, without waiting for every platform to ship a full official pull API.

## Scope

Phase 1 includes:

- a workspace-local `publish object catalog` persisted next to project-local publication bindings
- a normalized display profile model with:
  - stable object identity
  - title / subtitle
  - parent object information
  - source priority
  - display quality
- catalog merge from three sources:
  - binding `metadata.publishObject`
  - inbound-learned remote identity facts
  - manual fallback inferred from binding scope
- bridge output that prefers catalog-resolved object identity for:
  - binding catalog audiences
  - active session catalog entries
- publication UI status that distinguishes:
  - resolved business objects
  - fallback objects that still need better identification

Phase 1 does not include:

- full official pull discovery clients for every platform
- background refresh schedulers
- explicit rename reconciliation jobs
- new platform-specific management screens

## Product Behavior

### Catalog

Each workspace keeps a durable publish-object catalog document under project automation channel state.

Each record represents one native publish object under one channel account and stores:

- channel account id
- native object type
- native object id
- optional parent native object id
- display title
- optional display subtitle
- optional parent display title
- source: `official-pull | runtime-resolved | inbound-learned | manual`
- quality: `resolved | inferred | fallback`
- last resolved timestamps
- raw facts useful for future refreshes

### Merge Rules

Priority order:

1. `official-pull`
2. `runtime-resolved`
3. `inbound-learned`
4. `manual`

Quality rules:

- a real business title from runtime/plugin resolution or stored publish-object metadata is `resolved`
- a title derived from inbound facts but still business-readable is `inferred`
- a title produced from route ids or generic platform labels is `fallback`

### Backfill

When reading a project publication catalog:

- binding `metadata.publishObject` records are materialized into catalog entries
- remote identities are converted into catalog candidates and merged
- missing catalog state is backfilled and written to disk

This gives legacy bindings a stable display layer without requiring a separate migration command.

### Bridge Contract

`channelBridge` should enrich `IChannelAudienceEntry` and `IChannelActiveSessionEntry` with catalog-resolved display state.

The renderer should no longer decide quality only from route strings. It should consume:

- resolved object title / subtitle
- parent object title
- display source
- display quality

### Renderer Contract

The publication page should:

- show the resolved object title as the main label
- show a visible low-confidence indicator for `fallback` objects
- keep add-publication flow unchanged for this slice, but use catalog-resolved option labels when available

## Implementation Outline

1. Extend channel publication domain types with publish-object catalog/display-profile types.
2. Extend `ProjectChannelPublicationService` to read, normalize, merge, and persist catalog entries.
3. Reuse `imObjects.ts` for normalization helpers, but stop treating its string formatting as the final product contract.
4. Make `channelBridge` resolve audiences and active sessions through the catalog.
5. Surface display quality in renderer view models and tags.

## Acceptance Criteria

- Existing publication bindings with `metadata.publishObject` appear through a formal catalog record.
- Remote identities can improve display title / subtitle / parent title for the same publish object.
- Unresolved objects are explicitly marked as fallback instead of silently pretending to be fully identified.
- Publication cards and publish-object selector labels use catalog-resolved titles when present.
- Focused tests cover merge precedence, backfill persistence, and low-confidence UI state.
