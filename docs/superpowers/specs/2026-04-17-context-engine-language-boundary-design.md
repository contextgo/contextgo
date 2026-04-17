# Context Engine Language Boundary Design

## Goal

Close `#124` and `#133` by stabilizing the language and boundary layer underneath the already-merged Context Engine runtime, without changing the governing runtime model itself.

This means:

- define the current Context Engine object vocabulary in terms that map directly to code
- separate `Context Engine core` from `Memory Provider` concerns in code boundaries
- keep the existing three-identity, dual-loop governance runtime intact

## Fixed Architectural Constraints

This design treats the following as already decided and non-negotiable:

- governance is expressed through three stable ContextGo identities:
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- the runtime is a dual-loop system:
  - session loop
  - project/space evolution loop
- capability surfaces remain ContextGo-native and runtime-neutral:
  - agent packages
  - skills
  - hooks
  - commands
  - schedules
- the governance trigger surface remains:
  - `hook`
  - `lifecycle`
  - `timer`
  - `manual`
  - `connector`
  - `derived`

This PR must not introduce:

- a second memory engine
- a second governance-routing model
- a second session recall/archive subsystem
- a design where the memory provider becomes the real runtime owner and the three governance identities become secondary

## What This PR Is Actually Doing

This PR is not inventing a new runtime.

It is doing three practical things:

1. giving existing Context Engine objects stable names
2. drawing clear code boundaries between governance logic and provider/storage logic
3. preventing future issues (`#123`, `#126`, `#130`, `#131`, `#136`, `#142`) from growing in inconsistent directions

## Existing Code Mapping

### 1. Governance Runtime Layer

These files already define the active runtime model and must remain the owner of governance behavior:

- `src/common/config/presets/systemAssistants/contextEngineAssistants.ts`
- `src/process/services/context/ContextJobOrchestrator.ts`
- `src/process/services/context/events/ContextTriggerRouter.ts`
- `src/process/services/context/events/triggers/builtinTriggers.ts`
- `src/process/services/context/ContextRuntimeService.ts`

These files answer:

- who governs
- when governance triggers
- how session/project/space loops operate

They are not storage/provider abstractions.

### 2. Governance Output / Artifact Layer

These files write the actual output surfaces of the current engine:

- `src/process/services/context/jobs/SessionCompactionJobHandler.ts`
- `src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts`
- `src/process/services/context/jobs/SpaceMemoryDistillationJobHandler.ts`
- `src/process/services/context/jobs/ConnectorDigestJobHandler.ts`
- `src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts`
- `src/process/services/context/jobs/SpaceCuratorDistillationFormatter.ts`
- `src/process/services/space/SpaceVaultContextSyncService.ts`

These files are where the current ontology already appears in practice:

- session timeline
- session working context
- session checkpoint
- project proposal / capability artifact
- space digest
- profile memory
- connector digest

### 3. Engine / Provider Storage Layer

These files are currently carrying both engine semantics and provider/storage mechanics:

- `packages/context-engine/src/domain.ts`
- `packages/context-engine/src/contracts.ts`
- `packages/context-engine/src/ContextEngineService.ts`
- `src/process/services/context/ContextServiceImpl.ts`

This is the layer to realign.

### 4. Projection / Observability Layer

These files only project runtime state outwards:

- `src/common/adapter/ipcBridge.ts`
- `src/process/bridge/services/ActivitySnapshotBuilder.ts`
- `src/process/services/context/events/handlers/ContextJobRunProjector.ts`
- `src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx`

They should not become ontology owners.

## Ontology Direction (`#124`)

The current package-level domain already contains the right primitive families:

- `SourceRecord`
- `DocumentSnapshot`
- `ChunkRecord`
- `MemoryEntry`
- `MemoryCandidateEntry`
- `ProfileSegment`
- `ContextPack`

The problem is not missing nouns. The problem is that the nouns are not yet presented as a stable layered vocabulary that later code can depend on without reinterpretation.

### Formal object families to preserve

This PR should stabilize the following layered interpretation:

- raw/source-aware objects
  - `SourceRecord`
  - `DocumentSnapshot`
- retrieval/index objects
  - `ChunkRecord`
- semantic state objects
  - `MemoryEntry`
  - `MemoryCandidateEntry`
  - `ProfileSegment`
- execution assembly objects
  - `ContextPack`
- governance/output objects
  - session/project/space artifacts already written through the current job handlers

### What this PR will not do for ontology

- it will not invent a brand-new graph object model
- it will not implement the full relation engine from the issue body
- it will not force the renderer to learn a second ontology vocabulary

Instead, it will make the current vocabulary explicit enough that future graph/projection/retrieval work can build on it honestly.

## Context Engine Core vs Memory Provider (`#133`)

The key distinction to enforce is:

- `Context Engine core` governs context semantics and runtime formation
- `Memory Provider` supplies persistent storage / retrieval capabilities

Neither replaces the other.

### Context Engine core responsibilities

The core is responsible for:

- ingesting runtime signals into engine semantics
- forming memory candidates and governance decisions
- assembling context packs
- handling compaction / promotion / forgetting policy decisions
- coordinating governance job inputs and outputs

### Memory provider responsibilities

The provider axis is responsible for:

- storing and retrieving source/document/chunk/memory/profile data
- operation-log persistence
- provider-specific indexing/search support
- durable storage implementation details

### Current code smell to fix

Today, the package contracts blur these responsibilities because:

- `ContextEngineDependencies` mixes provider stores and engine policy dependencies in one flat structure
- `ContextServiceImpl` extends `ContextEngineService` directly and exposes a composite interface that does not clearly distinguish provider-backed responsibilities from engine semantics

The PR should not attempt a giant rewrite, but it should make the split legible and enforceable.

## Concrete Boundary Changes

### 1. Stabilize domain language in `packages/context-engine`

Expected changes:

- add or refine grouped comments and type exports around the existing object families
- make the domain file readable as a stable language source instead of a loose list of records
- avoid renaming the core objects unless absolutely necessary

### 2. Separate core contracts from provider contracts

Expected changes in `packages/context-engine/src/contracts.ts`:

- keep `IContextService` / engine-facing behavior centered on semantic operations
- split provider-facing store contracts into a clearly named provider dependency section
- make it obvious which interfaces represent engine semantics and which represent provider/storage capability

### 3. Introduce a provider-facing dependency wrapper instead of a giant rewrite

Expected changes:

- either define a new `MemoryProvider`-shaped contract or a similarly named adapter-facing type
- adapt the current dependency structure to that boundary
- keep `ContextServiceImpl` working with minimal migration churn

This PR is allowed to add a compatibility layer. It is not allowed to require full codebase migration in one shot.

### 4. Preserve the current governance runtime layer unchanged in ownership

Expected changes:

- governance runtime files continue to own the steward/curator loops
- package-layer boundary work must not drag governance semantics into provider abstractions

### 5. Keep renderer and bridge changes minimal

Expected changes:

- bridge or renderer updates only if new type names need exposure for consistency
- no UI redesign

## File Plan

Primary files expected to change:

- `packages/context-engine/src/domain.ts`
- `packages/context-engine/src/contracts.ts`
- `packages/context-engine/src/ContextEngineService.ts`
- `packages/context-engine/src/index.ts`
- `src/process/services/context/ContextServiceImpl.ts`

Possible compatibility/supporting files:

- `packages/context-engine/docs/domain-model.md`
- `src/process/services/context/contextDomain.ts`
- `tests/unit/context-engine/*`

These changes should remain centered on language and boundaries, not feature expansion.

## Testing Strategy

This PR should prove three things:

### 1. Current runtime behavior still works

Run and preserve:

- context-engine unit tests
- current governance/runtime flow tests
- retrieval/assembly tests already covering `ContextServiceImpl`

### 2. The package boundary is clearer and still usable

Add or adjust tests so the codebase proves:

- engine service still works through the new/clarified contract boundary
- provider/store dependencies can be reasoned about independently from governance/runtime logic

### 3. No governance ownership regression

Verify that:

- steward/curator runtime code still routes through the current governance files
- the provider split has not absorbed trigger/job/runtime ownership

## Non-Goals

This PR explicitly does not close:

- `#123` source-aware ingestion pipeline
- `#126` assembly contract completion
- `#130` hierarchical retrieval planning
- `#131` retrieval/assembly trace surface
- `#136` live vs frozen mounted state
- `#142` vault graph / projection layering

It is preparing those issues to land on a stable base.

## Success Criteria

This PR is successful when:

- the current Context Engine object language is readable and stable in code
- `Context Engine core` and `Memory Provider` are distinct enough in code boundaries that future work cannot casually recombine them
- the already-merged three-identity, dual-loop runtime remains the unambiguous runtime owner
- later epic work can extend the current system without re-litigating basic naming and boundary questions
