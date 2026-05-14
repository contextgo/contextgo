# Context Engine Event Architecture

## Goal

ContextGo should treat the Context Engine as an event-driven memory and context-maintenance system that sits beside the user-facing agent runtime.

The runtime remains responsible for immediate execution. The Context Engine listens to runtime facts, detects higher-level signals, schedules context jobs, and feeds compacted context back into future turns.

## Core Principle

The architecture is mixed-mode:

- Request-driven path:
  - `retrieve`
  - `assemble`
  - `prepareOutgoingTurn`
- Event-driven path:
  - session signal detection
  - session compaction scheduling
  - project promotion scheduling
  - connector digestion
  - space memory refresh

Do not model the whole app around a global event bus. Keep the first event bus scoped to the Context Engine domain.

## Layering

```text
Agent Runtime / Hooks / Connector Sync
  -> ContextEventBus
    -> SessionSignalProjector
    -> ContextJobProjector
    -> VaultProjector
    -> OperationAppender
      -> ContextOperationLog
```

## Domain Objects

### ContextJob

Background maintenance work owned by the Context Engine.

Initial job kinds:

- `session_compaction`
- `session_pattern_detection`
- `project_promotion`
- `space_memory_distillation`
- `connector_digest`

### SessionSignal

A compact semantic signal derived from runtime facts.

Initial signal kinds:

- `user_interrupt`
- `repeated_request`
- `strategy_shift`
- `tool_failure_cluster`
- `memory_candidate_created`
- `memory_candidate_promoted`
- `context_window_prepared`

### ProjectPromotionCandidate

A stable insight that is strong enough to move from session scope into project wiki scope.

### ConnectorSource

A normalized external context source that can later become source records, memory candidates, or space-level memory.

## Event Bus Scope

The first event bus should be:

- process-local
- strongly typed
- ordered per publish call
- used only inside `src/process/services/context/`

It is not the app-wide IPC layer and not a distributed queue.

## First Event Types

- `session.turn.started`
- `session.turn.completed`
- `session.interrupted`
- `context.window.prepared`
- `session.signal.detected`
- `memory.candidate.created`
- `memory.candidate.promoted`
- `project.promotion.proposed`
- `connector.source.ingested`

## Responsibility Split

### ContextEventBus

Transient fan-out for domain events.

### ContextOperationLog

Durable record of important context facts.

### Projectors / Reactors

Consumers that update durable projections or enqueue background jobs.

Examples:

- `SessionSignalProjector`
- `ContextJobProjector`
- `VaultProjector`
- `OperationAppender`

## Planned Flow

### Turn preparation

1. Runtime prepares outgoing turn.
2. Context pack is assembled.
3. Runtime publishes `context.window.prepared`.
4. Signal and job projectors inspect the event.
5. Vault projector appends a session checkpoint.

### Turn completion

1. Runtime stores assistant output.
2. Runtime extracts memory candidates.
3. Runtime publishes `session.turn.completed` plus candidate outcomes.
4. Signal projector derives session signals.
5. Job projector decides whether to queue `session_compaction` or `project_promotion`.
6. Future turns retrieve compacted outputs through hooks.

## AGENTS / Vault Indexing Model

Project wiki should remain source-aware.

- `AGENTS.md` is the canonical project instruction entry point.
- nearby markdown docs remain source docs
- project wiki docs summarize and connect, but do not replace source ownership
- repo and connector context should be promoted into project or space docs only after signal detection and promotion decisions

## Implementation Phases

### Phase 1

- define domain objects
- define typed event schema
- add process-local `ContextEventBus`
- publish runtime events
- project session signals and queue context jobs

### Phase 2

- add durable context job store
- run background context jobs
- write compacted outputs back into vault docs and context memory

### Phase 3

- connector digestion
- cross-session synthesis
- space-level memory refresh
- hook-based reuse in future sessions
