# Context Strategy Adapter Design

## Goal

Close `#138` by introducing a runtime-neutral `External Memory Strategy Adapter SPI` that lets ContextGo absorb external memory/context strategies through explicit capability declarations instead of one-off integrations.

## Fixed Constraints

This work must preserve the architecture already running on `main`:

- governance remains owned by:
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- the runtime remains a dual-loop system:
  - session loop
  - project/space evolution loop
- agent packages remain runtime-neutral capability bundles
- capability surfaces remain ContextGo-native:
  - skills
  - hooks
  - commands
  - schedules
- the recently added language boundary and ingestion/assembly contracts remain the foundation

This PR must not:

- introduce a new top-level runtime model that competes with the current steward/curator runtime
- tie strategy adapters to one execution backend
- make a strategy adapter the source of truth for workspace/package state

## What This PR Is Actually Doing

This PR is not integrating Honcho, Hindsight, Supermemory, Mem0, or other systems directly.

It is doing three concrete things:

1. defining the adapter contract that external strategies must implement
2. making the adapter contract composable with the current Context Engine runtime
3. expressing adapter capabilities in a way the current agent-package/runtime model can understand

## Existing Code Mapping

### 1. The package/runtime boundary already exists

Current docs already define:

- runtime-neutral agent packages
- runtime projection rules
- product-owned capability surfaces

Primary documents:

- `docs/tech/agent-package-architecture.md`
- `docs/conventions/runtime-support.md`

### 2. The Context Engine core/provider boundary already exists

Current work already separates:

- Context Engine core
- provider/storage contracts

This means strategy adapters should layer **on top of** those contracts rather than replace them.

### 3. Evaluation groundwork already exists

The evaluation baseline workstream exists so strategy adapters can eventually be judged against stable regression expectations.

This PR should therefore make adapters measurable by design, even if it does not implement the full benchmark runner.

## Issue `#138`: External Memory Strategy Adapter SPI

### Current baseline

The system already has enough architectural pieces to support a strategy adapter layer:

- package/runtime-neutral capability model
- Context Engine core vs provider boundary
- governance runtime
- evaluation baseline workstream

What is missing is a formal adapter contract.

### Required direction

This PR should define:

- adapter identity
- capability matrix
- write semantics
- recall semantics
- cost/latency class
- safety boundary
- runtime composition contract

### Minimal implementation target

This PR should not ship a real external provider integration.

It should ship:

- the SPI types
- a registry/descriptor shape
- one stub/example adapter declaration proving the model works

## Concrete Design Direction

### 1. Strategy adapter is a runtime-neutral capability bundle

The adapter should declare:

- what it can do
- how it writes
- how it recalls
- what safety constraints it carries

It should not own the overall runtime.

### 2. Composition happens inside the current Context Engine model

The current runtime should be able to say:

- which strategy adapter is active
- which capabilities are available from it
- whether it participates in profile/search/reflect/graph/prefetch/tooling

without letting the adapter redefine steward/curator ownership.

### 3. Agent package compatibility remains explicit

If future agent packages want to opt into a strategy adapter, that should be declared explicitly and remain runtime-neutral.

This PR should therefore connect adapter declarations to the current package/runtime-neutral language rather than inventing runtime-specific configuration.

## File Plan

Primary files expected to change:

- `packages/context-engine/src/contracts.ts`
- `packages/context-engine/src/index.ts`
- `docs/tech/agent-package-architecture.md`
- `docs/conventions/runtime-support.md`

Likely supporting files:

- a new package-level strategy adapter contract file under `packages/context-engine/src/`
- focused tests under `tests/unit/context-engine/`

## Testing Strategy

This PR should prove three things:

### 1. The adapter SPI is explicit and typed

Verify:

- capability declarations are structured
- safety boundary is structured
- composition contract is structured

### 2. The SPI does not redefine runtime ownership

Verify:

- the adapter contract composes with the existing runtime rather than replacing it

### 3. The adapter layer stays runtime-neutral

Verify:

- no runtime-specific filesystem or backend coupling is introduced in the SPI itself

## Non-Goals

This PR does not ship:

- a real Honcho/Mem0/Supermemory runtime integration
- a benchmark dashboard
- a new UI surface

It only closes the missing SPI layer.

## Success Criteria

This PR is successful when:

- ContextGo has a stable strategy-adapter SPI
- future external strategy integrations become adapter work, not runtime surgery
- the SPI stays aligned with the current runtime-neutral package and Context Engine architecture
