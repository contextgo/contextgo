# Context Engine Trace And Mounted State Design

## Goal

Close `#130`, `#131`, and `#136` by making the existing retrieval and assembly path:

- structured enough to express a hierarchical retrieval plan
- observable enough to emit a first-class retrieval/assembly trace
- safe enough to distinguish live state from frozen mounted snapshots

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

- create a second retrieval subsystem outside the current `retrieve -> assemble -> ContextPack` path
- create a second observability plane unrelated to the current event/operation/runtime surface
- create a second session-memory model outside the current session artifact and mounted-context surfaces

## What This PR Is Actually Doing

This PR is not inventing a new engine.

It is doing three concrete things:

1. making the current retrieval path structured enough to record how it chose scope, collection, and evidence
2. making the current assembly path emit a first-class trace instead of only producing final `ContextPack`
3. making mounted context explicitly frozen and fenced so live state updates do not mutate current prompt semantics implicitly

## Existing Code Mapping

### 1. Current retrieval / assembly path

The current path already exists:

- `ContextServiceImpl.retrieve(...)`
- `ContextServiceImpl.assemble(...)`
- `ContextRuntimeService.prepareOutgoingTurn(...)`

The problem is not missing mechanics.

The problem is that the path is still too implicit about:

- scope selection
- overlay participation
- budgeting and dropped evidence
- what was live state vs. frozen mounted state

### 2. Current mounted-state behavior

The current runtime already mounts:

- session working context
- project context mirror sections
- session compaction profiles
- pinned runtime instructions

But the current code does not yet formalize:

- which of these are frozen for a turn
- which are mutable live state
- how that boundary should be represented in the contract

### 3. Current observability surface

The current code already has:

- operation log projection
- activity snapshots
- `System Runs`

But there is still no first-class per-turn retrieval/assembly trace object.

## Issue `#130`: Hierarchical Retrieval Plan

### Current baseline

Current retrieval is still primarily a flat merge of:

- memory hits
- chunk hits
- profiles
- sources

with project affinity and overlays applied around it.

### Required direction

This PR should make the retrieval path capable of describing:

- selected scope
- ranked collections
- chosen evidence
- dropped evidence

That does not require a full recursive planner yet.

It does require a stable structure that later planners can extend.

### Minimal implementation target

Add a retrieval-plan object that records:

- `scope`
- `collectionCandidates`
- `selectedCollections`
- `keptEvidenceIds`
- `droppedEvidenceIds`

The current retrieval logic may still be simple, but it must become structurally explainable.

## Issue `#131`: Retrieval Trace / Assembly Trace

### Current baseline

The system already emits operation logs and runtime state, but not a trace object that can answer:

- why this evidence was kept
- what got dropped
- how budget was spent
- which mounted overlays were frozen into the turn

### Required direction

This PR should introduce:

- `RetrievalTrace`
- `AssemblyTrace`

as stable runtime-side objects that can be:

- attached to turn preparation
- surfaced to debugging/observability surfaces later
- used by future UI and benchmark tooling

### Minimal implementation target

The trace can start as backend-only structured payload plus operation/runtime projection support.

It does not need a large new renderer surface in this PR.

## Issue `#136`: Live State + Frozen Snapshot Mounted State

### Current baseline

Current runtime assembly already mounts session/project overlays, but there is not yet a formal distinction between:

- live mutable state
- frozen mounted snapshot for the current turn

### Required direction

This PR should make that distinction explicit in contract and runtime behavior.

The turn should be assembled from a frozen snapshot boundary, even if the underlying long-lived state mutates later.

### Minimal implementation target

Introduce mounted-state metadata that can answer:

- what snapshot version was mounted
- which mounted sections came from frozen overlays
- whether a mounted source is recapturable/reingestable

This does not need a new storage engine.

It needs explicit boundary metadata and runtime semantics.

## Concrete Design Direction

### 1. Retrieval plan becomes a first-class intermediate object

The current retrieval path should return both:

- the existing retrieval result
- a structured retrieval plan/trace

This keeps compatibility while making the path explainable.

### 2. Assembly overlays become traceable participants

The current assembly contract should record:

- which overlays were mounted
- which ones were frozen for this turn
- how much budget they consumed
- whether they were policy/instruction, mounted overlay, or query evidence

### 3. Frozen snapshot semantics stay in the runtime/assembly path

`ContextRuntimeService` remains the runtime orchestrator.

It should explicitly mount a frozen snapshot for the turn, not simply pass through whatever live state currently exists without boundary semantics.

### 4. Observability stays additive

This PR should extend the existing observability path:

- operation log
- activity snapshot
- current settings/runtime surfaces

It should not create a second product-level trace UI.

## File Plan

Primary files expected to change:

- `packages/context-engine/src/contracts.ts`
- `packages/context-engine/src/ContextEngineService.ts`
- `src/process/services/context/ContextServiceImpl.ts`
- `src/process/services/context/ContextRuntimeService.ts`
- `src/process/bridge/services/ActivitySnapshotBuilder.ts`

Likely supporting files:

- `src/common/adapter/ipcBridge.ts`
- `src/process/services/context/events/handlers/OperationLogProjector.ts`
- `tests/unit/context-engine/contextEngineService.test.ts`
- `tests/unit/context-engine/contextRuntimeService.test.ts`
- `tests/unit/extensionsBridge.test.ts`

This PR should stay centered on retrieval structure, traceability, and mounted-state semantics. It must not expand into graph UI or benchmark infrastructure.

## Testing Strategy

This PR should prove three things:

### 1. Retrieval is now structurally explainable

Verify:

- retrieval returns a plan/trace object
- selected scope/collections/evidence are visible in tests
- dropped evidence and budget boundaries are inspectable

### 2. Assembly is now traceable and frozen

Verify:

- mounted overlays are marked as frozen turn inputs
- assembly trace distinguishes overlays vs query evidence vs instructions
- later runtime state mutation does not implicitly change the already-built mounted snapshot for a turn

### 3. Governance ownership remains unchanged

Verify:

- steward/curator runtime ownership stays in existing runtime files
- retrieval plan / trace / frozen snapshot changes do not move governance routing ownership into package/provider layers

## Non-Goals

This PR does not close:

- `#123` raw ingestion pipeline
- `#126` assembly contract cleanup
- `#128` benchmark/evaluation baseline
- `#129` context namespace/tree UI
- `#142` vault graph / projection layering

It prepares those issues to land on a traceable and stable retrieval/mounted-state base.

## Success Criteria

This PR is successful when:

- the current retrieval path can explain itself structurally
- the current assembly path can explain itself structurally
- mounted state is explicitly frozen per turn rather than implicitly live
- the existing three-identity, dual-loop governance runtime remains unchanged in ownership
