# Context Engine Lifecycle Hook Contract Design

## Goal

Make lifecycle-driven governance in the Context Engine run through a single formal contract, so `turn`, `session`, `compression`, and `delegation` events enter the governance loop through one stable path instead of multiple ad hoc job projection paths.

## Scope

- formalize the Context Engine lifecycle event contract used by governance-triggered jobs
- make `ContextTriggerRouter` the single event-to-job entry for governance orchestration
- add a formal `delegation.completed` lifecycle event that can feed session governance
- keep current `context.window.prepared`, `session.turn.completed`, and `session.interrupted` flows working
- update tests around router, runtime event production, and end-to-end event flow

## Non-Goals

- changing the renderer or `System Runs` UI in this patch
- redesigning retrieval or context assembly in this patch
- introducing a large new event taxonomy beyond the minimum lifecycle set
- changing IPC payloads or exposing a new renderer-facing contract in this patch

## Problem

The codebase already has event vocabulary for `hook`, `lifecycle`, `timer`, `connector`, and `derived`, but governance ownership is still split.

Today:

- `ContextTriggerRouter` already maps several runtime events into jobs
- `ContextJobProjector` still duplicates similar event-to-job behavior
- lifecycle semantics are partially present, but not yet treated as a formal contract
- there is no first-class `delegation.completed` lifecycle event to represent completed execution evidence

This creates two risks:

- governance routing can drift because two projection paths evolve independently
- later `session-to-memory` and `profile operations` work will build on unstable lifecycle semantics

## Architecture

This patch keeps the current event bus and job orchestrator roles, but sharpens ownership:

- `ContextEventBus`
  - transport only
  - no governance policy
- `ContextTriggerRouter`
  - lifecycle hook contract owner
  - single event-to-job routing entry for governance
- `ContextJobOrchestrator`
  - policy owner for queueing, priority, reason, and artifact-target decisions
- `ContextRuntimeService`
  - runtime event producer only
  - emits formal governance events, but does not directly create governance jobs

The old direct projection path must stop being a second source of truth. `ContextJobProjector` should either become a thin compatibility shell that delegates into the router or be reduced so it no longer independently evolves event-to-job behavior.

## Contract Shape

This patch formalizes a minimal lifecycle contract instead of trying to event-model every runtime action.

### Supported governance events

- `context.window.prepared`
  - source class: `hook`
  - meaning: a context assembly pass finished and session governance may refresh working context
- `session.turn.completed`
  - source class: `hook`
  - meaning: a user/assistant turn closed and governance may compact the latest session state
- `session.interrupted`
  - source class: `lifecycle`
  - meaning: session continuity changed and governance should capture interruption/drift signals
- `delegation.completed`
  - source class: `lifecycle`
  - meaning: a delegated execution segment or clustered execution step finished and governance may treat its outcome as session evidence

### Source rules

- `hook`
  - explicit runtime milestones in the main execution path
- `lifecycle`
  - state transitions that affect session continuity or governance semantics
- `derived`
  - internal Context Engine follow-up events derived from completed jobs only

### Event envelope

Governance-capable lifecycle events should share a common envelope:

- `spaceId`
- `threadId`
- `projectSlug?`
- `occurredAt`
- `sourceSummary?`

Each event may also carry event-specific fields:

- `snapshot`
- `interruptionReason`
- `delegationSummary`
- other bounded event-local details

### Routing guardrails

- events missing governance boundary fields must not enter governance job routing
- `delegation.completed` may add evidence to session governance, but does not directly create a new artifact type in this patch
- derived promotion flow remains internal to Context Engine job completion handling

## Concrete Changes

### 1. Contract types

Update the main process context domain and trigger types so lifecycle payloads and supported trigger kinds are explicit enough to carry formal governance semantics.

Primary files:

- `src/process/services/context/contextDomain.ts`
- `src/process/services/context/events/triggers/types.ts`

### 2. Trigger registry and routing

Add the new lifecycle trigger and make the router the single governance-routing owner.

Primary files:

- `src/process/services/context/events/triggers/builtinTriggers.ts`
- `src/process/services/context/events/ContextTriggerRouter.ts`

Expected behavior:

- register `delegation.completed`
- keep current hook/lifecycle/timer flows working
- reject or ignore incomplete governance payloads instead of routing them into jobs

### 3. Runtime event production

Update runtime-side producers so they emit formal lifecycle events rather than growing new direct job-creation paths.

Primary file:

- `src/process/services/context/ContextRuntimeService.ts`

Expected behavior:

- keep emitting `context.window.prepared` and `session.turn.completed`
- emit `delegation.completed` with the common governance envelope plus delegation-specific summary fields
- avoid direct governance job creation in runtime service code

### 4. Duplicate projection-path reduction

Reduce `ContextJobProjector` so governance routing semantics are not maintained in two places.

Primary file:

- `src/process/services/context/events/handlers/ContextJobProjector.ts`

This patch does not require deleting the file if that would create noisy churn. It does require removing it as an independently evolving governance-routing implementation.

## Testing

Add or update tests in three layers:

### Router contract tests

Verify that:

- `session.turn.completed` routes through the formal trigger path
- `session.interrupted` routes as a lifecycle-sourced governance job
- `delegation.completed` can queue the expected governance follow-up
- incomplete lifecycle payloads are rejected or ignored

### Runtime service tests

Verify that:

- runtime service emits formal governance events instead of directly creating jobs
- `delegation.completed` includes the expected common envelope and delegation-specific fields
- existing hook event behavior does not regress

### Event-flow integration tests

Verify that:

- event -> router -> job -> artifact remains closed for session governance
- derived project-promotion routing still works
- session working context and checkpoint artifacts still materialize after compaction

## Rollout Notes

Keep the rollout intentionally small:

- add only one new formal lifecycle event in this patch: `delegation.completed`
- do not expand renderer/UI work in the same change
- do not mix retrieval/assembly changes into this contract patch

This keeps the branch on the governance-runtime-loop track and prepares later work on `session-to-memory`, `profile operations`, and formal assembly contracts.
