# Context Engine Phase 2 Closure Design

## Goal

Deliver a single implementation stream that closes the remaining Context Engine Phase 2 governance/runtime issues:

- `#125`
- `#127`
- `#132`
- `#134`
- `#137`

without breaking the architecture already merged on `main`.

## Product / Architecture Baseline

This design treats the following as fixed constraints, not open questions:

- governance is expressed through three stable ContextGo identities:
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- the runtime model is a dual-loop system:
  - session loop
  - project/space evolution loop
- the capability surface remains ContextGo-native and runtime-neutral:
  - agent packages
  - skills
  - hooks
  - commands
  - schedules
- governance routing stays on the current trigger model:
  - `hook`
  - `lifecycle`
  - `timer`
  - `manual`
  - `connector`
  - `derived`

No work in this batch may introduce a parallel memory engine, a parallel session-recall subsystem, or a second governance-routing model.

## Scope

This batch closes the following issue clusters in one coordinated PR:

### `#134` Lifecycle Hook Contract

- complete the current governance lifecycle contract rather than inventing a new one
- keep `ContextTriggerRouter` as the single governance-routing owner
- extend turn/session/compression/delegation coverage through the current event-trigger-runtime path

### `#137` Context Compression Formalization

- formalize the current `Session Steward` compaction path
- define compaction invariants, budgets, provenance, and handoff-summary rules
- make `timeline`, `working context`, and `checkpoints` operate as one coherent compression surface

### `#125` Memory Extraction + Profile Operations

- move extraction and profile mutation closer to a formal operation model
- distinguish candidate extraction, profile operations, and durable-state transitions
- preserve the current governance-job ownership rather than spinning out a separate memory runtime

### `#132` Usage Evidence

- record and use evidence about:
  - used context
  - used skills
  - used hooks / commands / schedules
- feed that evidence into the existing governance loop
- affect promotion, review, and retention decisions through the current steward/curator pipeline

### `#127` Connector Provenance + Incremental Ingestion

- continue the existing `Space Curator` / `connector_digest` path
- formalize connector provenance, replay, and incremental-ingestion semantics
- make connector digests a stronger source-aware governance input

### Product/UI Closure

- expose the new runtime states, evidence, and provenance in the current renderer observability surfaces
- keep the UI additive and governance-focused
- do not introduce a second product surface for context management

## Non-Goals

- rewriting the full Context Engine ontology layer (`#124`)
- completing retrieval/assembly/namespace phases outside the issue set above
- inventing a brand-new memory provider architecture
- inventing a brand-new recall/archive subsystem
- replacing the current `System Runs` and settings information architecture wholesale

## Delivery Shape

Externally this remains:

- one worktree
- one branch
- one PR

Internally it is executed in four tightly ordered batches.

## Internal Batch Plan

### Batch 1: Governance Contract Core

Primary target:

- `#134`

Work:

- complete the lifecycle contract on top of the current event bus / trigger router / runtime path
- extend governance routing coverage for turn/session/compression/delegation
- keep `ContextTriggerRouter` as the single governance contract owner
- sharpen event payloads, trigger specs, and guardrails

Expected result:

- all later memory, compression, usage, and connector work attaches to one runtime contract

### Batch 2: Compression + Extraction + Profile Operations

Primary targets:

- `#137`
- `#125`

Work:

- formalize `session_compaction` into a stable compression protocol
- define compaction invariants and budget semantics
- add stronger artifact provenance for `timeline`, `working context`, and `checkpoints`
- evolve extraction/profile handling into a formal operation flow under current governance jobs

Expected result:

- `Session Steward` becomes a clearly defined compression + extraction runtime actor

### Batch 3: Usage Evidence + Connector Provenance

Primary targets:

- `#132`
- `#127`

Work:

- add usage evidence as a first-class governance input
- record used-context and used-capability evidence
- route that evidence into current promotion/review/retention logic
- strengthen connector provenance and incremental-ingestion semantics inside the current `Space Curator` path

Expected result:

- session/project/space governance begins to depend on real usage evidence and stronger connector provenance

### Batch 4: Product Closure

Primary target:

- close all five issues at the product/runtime level

Work:

- expose the new states and evidence in current renderer observability surfaces
- ensure the three governance identities and dual-loop behavior remain readable in UI
- complete test coverage, issue closure notes, and final PR packaging

Expected result:

- the five issues are not just partially implemented in the main process; they are operationally and observably closed

## Module Plan

### Governance Contract

- `src/process/services/context/contextDomain.ts`
- `src/process/services/context/events/types.ts`
- `src/process/services/context/events/triggers/types.ts`
- `src/process/services/context/events/triggers/builtinTriggers.ts`
- `src/process/services/context/events/ContextTriggerRouter.ts`

Responsibility:

- keep a single governance event/trigger language
- encode trigger ownership, payload guardrails, and routing semantics

### Session Steward Core

- `src/process/services/context/ContextJobOrchestrator.ts`
- `src/process/services/context/ContextRuntimeService.ts`
- `src/process/services/context/jobs/SessionCompactionJobHandler.ts`
- `src/process/services/space/SpaceVaultContextSyncService.ts`

Responsibility:

- formalize session compaction
- write and consume session artifacts coherently
- express extraction/profile changes through current steward paths

### Project / Space Governance Jobs

- `src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts`
- `src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts`
- `src/process/services/context/jobs/SpaceMemoryDistillationJobHandler.ts`
- `src/process/services/context/jobs/SpaceCuratorDistillationFormatter.ts`
- `src/process/services/context/jobs/ConnectorDigestJobHandler.ts`

Responsibility:

- keep project/space evolution on the current curator path
- absorb usage evidence and connector provenance into the existing job system

### Projection / Bridge

- `src/common/adapter/ipcBridge.ts`
- `src/process/bridge/services/ActivitySnapshotBuilder.ts`
- `src/process/services/context/events/handlers/ContextJobRunProjector.ts`

Responsibility:

- project runtime state and observability to the renderer without adding UI-side inference

### Renderer Closure

- `src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx`
- `src/renderer/pages/settings/AgentSettings/AgentSettingsPage.module.css`
- any minimal supporting settings/runtime console modules needed to surface the new runtime state

Responsibility:

- keep observability readable
- show the current three-identity governance model and its artifacts/evidence/provenance

### Tests

- `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- `tests/unit/context-engine/contextJobOrchestrator.test.ts`
- `tests/unit/context-engine/contextRuntimeService.test.ts`
- `tests/unit/context-engine/contextScheduleService.test.ts`
- `tests/unit/process/services/spaceVaultContextSyncService.test.ts`
- `tests/unit/extensionsBridge.test.ts`
- `tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`

Responsibility:

- verify the contract, the governance jobs, the artifact paths, and the renderer observability surface

## Close Criteria

### `#134`

Close when:

- turn/session/compression/delegation all route through the same governance contract
- no parallel governance-routing model remains
- trigger classes and lifecycle semantics are explicit enough to extend safely

### `#137`

Close when:

- `session_compaction` is governed by explicit compression rules
- artifact provenance, budgets, and handoff semantics are formalized
- the session artifact triad is stable and coherent

### `#125`

Close when:

- extraction/profile state changes are formalized under current governance jobs
- candidate/profile/durable-state boundaries are explicit
- review/promotion/contradiction/temporal handling have a first formal loop

### `#132`

Close when:

- usage evidence exists as a real governance input
- used context and used capability surfaces affect governance outcomes
- the implementation extends current loops rather than creating telemetry-only side channels

### `#127`

Close when:

- connector provenance and incremental-ingestion semantics are formalized
- connector digest remains inside the current `Space Curator` path
- connector results can influence later governance and observability in a traceable way

## Risks

### Scope risk

This is a large batch even with a single architecture. The main mitigation is the internal four-batch execution order.

### Architecture drift risk

`#125`, `#132`, and `#127` are the most likely to drift into parallel subsystems unless every design and code change is checked against the current three-identity model.

### UI sprawl risk

UI closure is required, but it must remain subordinate to runtime closure. No new product-level context-management surface should emerge in this batch.

### Verification risk

Because this is one PR, verification must happen incrementally through the four internal batches and then again at full-repo level before closure.

## Success Criteria

This batch succeeds when:

- the five issues can be closed honestly
- the codebase remains aligned with the three-governance-identity, dual-loop runtime model
- no second memory/recall/governance subsystem is introduced
- the main process and renderer together expose a coherent, test-backed governance runtime closure
