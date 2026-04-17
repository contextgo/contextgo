# Context Engine Ingestion And Assembly Design

## Goal

Close `#123` and `#126` by formalizing two things on top of the existing Context Engine runtime:

- a source-aware raw context ingestion path
- a stable context assembly contract

without changing the already-merged three-identity, dual-loop governance runtime.

## Fixed Constraints

This work must preserve the architecture already running on `main`:

- governance remains owned by:
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- the runtime remains a dual-loop system:
  - session loop
  - project/space evolution loop
- capability surfaces remain ContextGo-native:
  - agent packages
  - skills
  - hooks
  - commands
  - schedules
- existing trigger classes remain:
  - `hook`
  - `lifecycle`
  - `timer`
  - `manual`
  - `connector`
  - `derived`

This PR must not:

- create a second ingestion subsystem outside the current context service/runtime path
- create a second assembly layer outside the current `retrieve -> assemble -> ContextPack` path
- move governance ownership out of the current steward/curator runtime

## What This PR Is Actually Doing

This PR is not inventing a new engine.

It is doing three concrete things:

1. making current raw-ingest entry points speak one stable source-aware lifecycle
2. making current assembly inputs and overlays explicit enough to extend safely
3. preventing future connector/file/vault ingestion and assembly work from continuing to drift across ad hoc paths

## Existing Code Mapping

### 1. Current ingestion entry points

The code already has multiple raw context entry paths:

- `ContextRuntimeService`
  - conversation user/assistant messages ingest into source/document/chunk
- `ProjectContextMirrorService`
  - vault/project docs are mirrored into source-aware context sections
- connector jobs and connector-triggered flows
  - connector content already becomes source-aware digest input

These paths already exist, but they do not yet read as one explicit ingestion lifecycle.

### 2. Current assembly path

The assembly path already exists:

- `ContextServiceImpl.retrieve(...)`
- `ContextServiceImpl.assemble(...)`
- `ContextRuntimeService.prepareOutgoingTurn(...)`

The problem is not missing mechanics.

The problem is that the current assembly contract is still too implicit about:

- what counts as raw retrieval input
- what counts as mounted overlay input
- how thread/session/project/space layers combine
- which inputs belong to assembly vs. governance vs. provider storage

### 3. Current support services

Primary existing files:

- `packages/context-engine/src/contracts.ts`
- `packages/context-engine/src/ContextEngineService.ts`
- `src/process/services/context/ContextServiceImpl.ts`
- `src/process/services/context/ContextRuntimeService.ts`
- `src/process/services/space/ProjectContextMirrorService.ts`

These are the files to refine, not replace.

## Issue `#123`: Source-Aware Raw Context Ingestion

### Current baseline

The system already ingests:

- conversation turns
- mirrored project docs
- connector-derived content

But the lifecycle is not yet stated as one explicit contract.

### Required direction

This PR should formalize the raw-ingestion lifecycle as:

`raw input -> source registration -> document snapshot -> chunk set -> indexable retrieval input -> downstream governance/assembly visibility`

That does not mean implementing every future ingestion mode.

It means making the current entry points use one coherent contract and one coherent vocabulary.

### What this PR should make explicit

- source identity and provenance expectations
- snapshot/chunk/index lifecycle responsibilities
- what “active” raw context means
- how mirrored project docs and conversation messages fit the same source-aware story

## Issue `#126`: Assembly Contract

### Current baseline

The current assembly path already combines:

- retrieval output
- thread summary
- mounted sections
- mounted profiles
- pinned instructions

### Required direction

This PR should make the assembly contract legible enough that future work cannot keep inventing new overlay semantics ad hoc.

The contract needs to state more clearly:

- retrieval result as the provider-fed semantic base
- mounted overlays as explicit assembly inputs
- session/project/space overlays as explicit, typed assembly participants
- what belongs to assembly and what belongs to governance/runtime orchestration

### What this PR should not do

- it should not redesign retrieval itself
- it should not implement a new hierarchical assembly planner
- it should not move UI or renderer logic into assembly ownership

## Concrete Design Direction

### 1. Ingestion lifecycle vocabulary

The package/main-process contract should begin to distinguish:

- raw input registration
- source snapshot persistence
- chunk/index preparation
- assembly-visible source context

This can be done with clearer type names and helper contracts on top of the current `ingestSource` and `indexTextDocument` flow.

### 2. Assembly input vocabulary

The assembly contract should begin to distinguish:

- retrieval result
- mounted overlays
- durable mounted profiles
- pinned runtime instructions

These are already present in `AssembleContextPackInput`; the PR should make them explicit enough that future callers do not keep smuggling new semantics through generic fields.

### 3. Project mirror as first-class assembly overlay source

`ProjectContextMirrorService` currently contributes mounted sections.

This PR should keep that path, but make it clearer that:

- mirrored docs are an assembly overlay source
- not a separate assembly system
- not a governance runtime replacement

### 4. Runtime service remains the orchestrator, not the storage layer

`ContextRuntimeService` should continue to:

- gather runtime-local inputs
- call retrieve/assemble
- ingest raw turn data

But the PR should reduce the amount of implicit lifecycle meaning hidden in that orchestration code by relying on more explicit contract helpers.

## File Plan

Primary files expected to change:

- `packages/context-engine/src/contracts.ts`
- `packages/context-engine/src/ContextEngineService.ts`
- `src/process/services/context/ContextServiceImpl.ts`
- `src/process/services/context/ContextRuntimeService.ts`
- `src/process/services/space/ProjectContextMirrorService.ts`

Likely supporting files:

- `packages/context-engine/docs/domain-model.md`
- `tests/unit/context-engine/contextEngineService.test.ts`
- `tests/unit/context-engine/contextRuntimeService.test.ts`
- `tests/unit/process/services/browserActivityConnectorService.test.ts`

This PR should stay centered on language, lifecycle, and contract clarity. It must not balloon into full connector/runtime/governance redesign.

## Testing Strategy

This PR should prove three things:

### 1. Existing ingestion paths still work

Verify:

- conversation turn ingestion still registers source/document/chunk as before
- mirrored project docs still feed assembly overlays
- connector-originated ingestion still reaches the current context path

### 2. Assembly contract is clearer but behavior-compatible

Verify:

- current retrieve/assemble behavior still works
- mounted overlays still contribute to `ContextPack`
- runtime preparation remains compatible with current tests

### 3. No governance ownership regression

Verify:

- steward/curator runtime ownership remains in the current runtime files
- ingestion/assembly cleanup does not absorb governance routing responsibilities

## Non-Goals

This PR does not close:

- `#124` / `#133` language-boundary work
- `#130` hierarchical retrieval planning
- `#131` retrieval/assembly trace surface
- `#136` live vs frozen mounted state
- `#142` vault graph / projection layering

It prepares those issues to land on a cleaner ingestion and assembly base.

## Success Criteria

This PR is successful when:

- current raw context inputs read as one explicit source-aware lifecycle
- current assembly inputs read as one explicit assembly contract
- future ingestion/assembly work can extend these paths without inventing parallel subsystems
- the already-merged three-identity, dual-loop governance runtime remains unchanged in ownership
