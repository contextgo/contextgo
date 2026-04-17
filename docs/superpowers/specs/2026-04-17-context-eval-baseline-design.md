# Context Engine Evaluation Baseline Design

## Goal

Close `#128` by establishing a first real regression and observability baseline for the current Context Engine, so future strategy changes can be judged against something more durable than intuition.

## Fixed Constraints

This work must preserve the architecture already running on `main`:

- governance remains owned by:
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- the runtime remains a dual-loop system:
  - session loop
  - project/space evolution loop
- benchmark and telemetry work must observe the current implementation, not invent a second execution path

This PR must not:

- replace real product/runtime flows with synthetic-only evaluation logic
- require a separate benchmark service to run the engine
- turn issue `#128` into a catch-all analytics platform

## What This PR Is Actually Doing

This PR is not building a giant benchmark framework.

It is doing three practical things:

1. locking a stable regression fixture layer around current retrieval / profile / promotion / connector behavior
2. exposing a minimal evaluation-oriented telemetry summary from existing runtime/projector surfaces
3. making future Context Engine strategy changes measurable through the current codebase

## Existing Code Mapping

### 1. There is already substantial test coverage

Current tests already cover:

- retrieval and assembly
- runtime preparation
- promotion and review
- compaction
- connector digestion
- governance event flow

Primary test surfaces:

- `tests/unit/context-engine/*`
- `tests/unit/extensionsBridge.test.ts`
- `tests/unit/process/services/spaceVaultContextSyncService.test.ts`

### 2. There is already telemetry-like runtime state

Current runtime already emits:

- operation log events
- job-run projections
- activity snapshots
- `System Runs`

Primary runtime surfaces:

- `ContextJobRunner`
- `ContextJobRunProjector`
- `ActivitySnapshotBuilder`

The problem is that these are not yet gathered into an explicit regression/evaluation baseline.

## Issue `#128`: Evaluation / Regression Baseline

### Current baseline

The codebase already has enough behavior to evaluate:

- retrieval output quality
- profile use
- promotion and review flow
- connector synthesis flow
- job execution signals

But those checks are still spread across many implementation-oriented tests and runtime projections.

### Required direction

This PR should create a small but durable baseline layer that can answer:

- did retrieval/assembly semantics change unexpectedly?
- did promotion/review behavior drift?
- did connector synthesis still feed the runtime path?
- did governance job traces still remain observable?

### Minimal implementation target

Introduce:

- curated regression fixtures
- a minimal evaluation summary structure
- test helpers that assert current quality-relevant invariants in one place

This does not need a full dashboard.

## Concrete Design Direction

### 1. Introduce fixture-style regression bundles

The baseline should include explicit fixture scenarios for:

- retrieval quality
- profile freshness/use
- promotion/review outcomes
- connector synthesis visibility

### 2. Reuse current runtime telemetry instead of inventing a second measurement plane

Current job-run/activity surfaces should supply the minimum telemetry needed to support regression assertions.

### 3. Keep the baseline close to the engine

The evaluation layer should live in tests and small supporting types/helpers, not in a separate long-running subsystem.

## File Plan

Primary files expected to change:

- `tests/unit/context-engine/contextEngineService.test.ts`
- `tests/unit/context-engine/contextRuntimeService.test.ts`
- `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- `tests/unit/extensionsBridge.test.ts`

Likely supporting files:

- `src/process/services/context/jobs/ContextJobRunner.ts`
- `src/process/services/context/events/handlers/ContextJobRunProjector.ts`
- `src/process/bridge/services/ActivitySnapshotBuilder.ts`

## Testing Strategy

This PR should prove three things:

### 1. Regression fixtures are explicit

Verify:

- tests can point to named scenarios rather than scattered ad hoc assertions

### 2. Telemetry summary is sufficient

Verify:

- current runtime/projector surfaces expose enough information to detect behavior drift in the covered scenarios

### 3. Baseline stays cheap enough to keep running

Verify:

- no new heavy benchmark harness is required just to keep the baseline alive

## Non-Goals

This PR does not close:

- `#138` external memory strategy adapter SPI

It prepares that future adapter work to be measured against a stable baseline.

## Success Criteria

This PR is successful when:

- the repo has a clearly identifiable Context Engine regression baseline
- future strategy changes can be checked against current retrieval/profile/promotion/connector behavior
- the current runtime remains the source of truth for evaluation, not a new analytics subsystem
