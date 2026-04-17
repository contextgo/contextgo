# IM Publication Entry Design

**Date:** 2026-04-17
**Status:** Approved for implementation

## Overview

`#117` already has most of the raw ingredients for a first-class IM publication model:

- `PublishObject` exists in the process domain and persisted publish-object catalog
- publication uniqueness is already enforced through durable binding conflict checks
- the renderer page is already Agent-first at the UI layer

The remaining gap is that bridge and renderer code still reconstruct the publication relationship from three lower-level buckets:

- `bindings`
- `audiences`
- `activeSessions`

That forces product-facing code to keep reasoning in `bindingId`, `scopeKey`, `audienceKey`, and `session` terms even when the page is supposed to show a durable publication into one platform-native object.

This slice introduces a formal `Publication` entry in the publication snapshot so product-facing consumers can read the durable relation directly.

## Problem

Today the durable publication relation is implicit.

The renderer derives one “published object card” by:

1. finding bindings for one Agent
2. resolving an audience from `scopeKey`
3. resolving a publish-object catalog entry from binding or audience facts
4. matching active sessions back through `bindingId`, `objectKey`, or `audienceKey`

That join logic works, but it keeps technical routing concepts in the main product path. It also spreads publication semantics across bridge and renderer instead of giving the domain one explicit carrier.

## Goals

- Add a first-class `Publication` entry to the publication snapshot
- Make the durable relation explicit: `Agent -> ChannelAccountInstance -> PublishObject`
- Attach the current active Project Session as a derived runtime pointer on that publication entry
- Let renderer publication-list code consume publications directly instead of rebuilding them from `audiences`, `bindings`, and `activeSessions`

## Non-Goals

- Replacing durable binding persistence in this slice
- Removing legacy bridge fields in one batch
- Changing add-publication or edit-publication mutation payloads
- Redesigning the active-session lifecycle beyond current projection behavior

## Proposed Model

Add a new domain type in `src/process/channels/types.ts`:

- `IChannelPublicationEntry`

Its role is to represent one durable publication relation already resolved into product language.

Recommended fields:

- `id`
  - use the durable binding id for now so delete/edit flows stay stable
- `agentProfileId`
- `channelAccountId`
- `channelAccountName`
- `channelAccountPlatform`
- `publishObject`
  - resolved `IChannelPublishObjectCatalogEntry`
- `binding`
  - the durable binding row for compatibility during the transition
- `currentSession`
  - optional `IChannelActiveSessionEntry`
- `enabled`
- `createdAt`
- `updatedAt`

The snapshot shape becomes:

- `catalog.publications?: IChannelPublicationEntry[]`

Legacy fields remain for now:

- `catalog.bindings`
- `catalog.audiences`
- `activeSessions`

This keeps current add/edit flows working while the listing path moves to the new domain object.

## Data Flow

### Process / Bridge

When reading or refreshing the publication snapshot:

1. build bindings
2. build audiences
3. build active sessions
4. attach active-session pointers to publish-object catalog entries
5. build `publications` by joining:
   - durable binding
   - resolved publish object
   - channel account metadata
   - newest active session belonging to that durable publication

The publication builder should prefer explicit durable binding/session links:

- `publicationBindingId`
- resolved publish-object catalog identity

Fallback matching can still use the current alias/object-key logic, but only inside the process builder.

### Renderer

The publication page should prefer `catalog.publications` for:

- published-object cards
- summary counts
- current active-session display

`audiences` remain available only for the add/edit flow, because the selector still needs the discovered object pool.

## Compatibility Strategy

This slice is additive.

- old snapshot consumers still receive `bindings`, `audiences`, and `activeSessions`
- the publication page can fall back to the previous derived-object path when `catalog.publications` is absent
- mutation APIs remain binding-based in this batch

That keeps the storage model and bridge contract compatible while shifting the main product surface to the new publication carrier.

## Testing

Add tests for:

1. bridge snapshot building
   - snapshot includes `catalog.publications`
   - each publication carries resolved publish-object identity plus current active session
2. renderer publication list
   - list renders from `catalog.publications` even when audience-derived object reconstruction would be incomplete
3. fallback compatibility
   - renderer still works if `catalog.publications` is absent

## Acceptance Criteria

- publication snapshot returns `catalog.publications`
- each publication entry directly answers:
  - which Agent is published
  - through which channel account
  - into which publish object
  - whether a current active Project Session exists
- publication-list rendering no longer depends on rebuilding that relation from raw audience/session joins
- add/edit publication flows remain functional with existing binding-based mutations
