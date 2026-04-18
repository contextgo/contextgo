# Context Engine Issue Realignment Design

## Goal

Realign the open Context Engine epic issues with the architecture that is already live on `main`, so the issue tracker reflects the actual product/runtime model instead of an earlier speculative design vocabulary.

## Scope

- align epic `#143` follow-up issues with the current Context Engine implementation on `main`
- focus only on the issues most affected by architecture drift:
  - `#125`
  - `#127`
  - `#132`
  - `#134`
  - `#135`
  - `#137`
- define which issues should be:
  - kept and rewritten
  - narrowed
  - closed
  - cross-linked
  - annotated with migration comments
- prepare direct GitHub issue edits after review

## Non-Goals

- implementing new Context Engine code in this pass
- rewriting the entire epic `#143`
- restructuring unrelated P1 issues outside the Context Engine track
- changing PR history or merge history

## Current Architectural Baseline

The issue tracker must now respect the architecture already present on `main`.

### Stable product/runtime constraints

- governance is expressed through three stable product identities:
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- the runtime model is a dual-loop system:
  - session loop
  - project/space evolution loop
- the execution model is built on the existing ContextGo runtime-neutral capability surface:
  - agent packages
  - skills
  - hooks
  - commands
  - schedules
- governance routing is already organized around the trigger classes now present in code:
  - `hook`
  - `lifecycle`
  - `timer`
  - `manual`
  - `connector`
  - `derived`

### Already-landed implementation facts

The following are not future proposals anymore. They are already part of the current implementation baseline on `main`:

- session loop foundation
- session artifact split:
  - timeline
  - working context
  - checkpoints
- project curator proposal/artifact flow
- space curator distillation artifacts
- governance runtime observability and `System Runs`
- first formal lifecycle contract slice, including `delegation.completed`

This means the issue tracker must stop describing these areas as if they still require a greenfield design.

## Problem

Several open epic-linked issues still use an older conceptual language:

- they assume some subsystems have not started, even though the first implementation slice already exists
- they describe potential new subsystems that would duplicate current runtime surfaces
- they do not consistently anchor work to the three governance identities and the dual-loop model
- they risk sending future implementation work into a parallel architecture instead of extending the one already merged

The tracker therefore needs architectural realignment before more implementation is delegated from it.

## Realignment Principles

### Principle 1: Preserve issue continuity where possible

Do not close and recreate issues unless the issue’s core framing is actively harmful.

Prefer:

- rewriting title/body
- narrowing scope
- adding cross-links
- adding migration comments

This keeps roadmap continuity intact.

### Principle 2: Follow the implementation that already won

Issue language must describe extension of the current architecture, not a second architecture.

Specifically:

- no new parallel memory-runtime language if the work belongs inside the current governance job/runtime path
- no independent session-recall subsystem that competes with the current session artifact surfaces
- no connector-ingest design that ignores the existing `connector_digest` and `Space Curator` path

### Principle 3: Keep the three-governance-identity model explicit

Issue bodies should describe work in terms of:

- which governance identity owns it
- which trigger classes can initiate it
- which artifact surfaces or durable state it affects

### Principle 4: Treat capability surfaces as first-class context inputs

Issues should respect the current product rule that:

- skills
- hooks
- commands
- schedules

are ContextGo-native capability surfaces that can be governed and projected, rather than runtime-specific implementation trivia.

## Per-Issue Decision Matrix

### `#134` Lifecycle Hook Contract

**Decision:** Keep, but rewrite substantially.

**Why:**

The direction is still correct, but the current issue reads too much like a greenfield contract-design task. `main` already contains a formal lifecycle-trigger slice and governance routing ownership.

**Rewrite target:**

- position this as follow-up work on the existing lifecycle contract
- explicitly reference the already-landed trigger/router/runtime model
- scope future work to contract completion, not contract invention

**Post-rewrite emphasis:**

- fill gaps in the current hook contract
- extend lifecycle coverage carefully
- avoid introducing a second external hook model

### `#137` Context Compression Subsystem

**Decision:** Keep, but narrow and rewrite.

**Why:**

The underlying concern is valid, but `session_compaction` is already a real production path. The issue should now formalize and stabilize the existing path instead of implying a fresh subsystem from scratch.

**Rewrite target:**

- make it about formalizing the existing `Session Steward` compaction path
- anchor it to current artifacts:
  - working context
  - checkpoints
  - timeline-derived evidence
- focus on invariants, budgets, provenance, and summary protocol

### `#127` Connector Sync As First-Class Context Ingestion

**Decision:** Keep, but rewrite into the existing `Space Curator` and `connector_digest` model.

**Why:**

The direction matches the product advantage, but the issue body is still too greenfield and underweights the implementation already present in `connector_digest`.

**Rewrite target:**

- explicitly state that connector ingestion extends the current `Space Curator` path
- build on source provenance and incremental digest enhancement
- avoid implying a separate connector context engine

### `#125` Memory Extraction And Profile Operations Runtime

**Decision:** Keep, but rewrite and constrain.

**Why:**

This is still needed, but the issue can drift into a parallel memory-runtime architecture if left unchanged.

**Rewrite target:**

- place extraction/profile operations under existing governance jobs and artifact/state transitions
- distinguish:
  - candidate extraction
  - profile operations
  - durable state transitions
- avoid language that implies replacing the current runtime wholesale

### `#132` Session-To-Memory Governance Loop

**Decision:** Keep, with moderate rewrite.

**Why:**

The problem statement is still aligned with the product, but it needs stronger anchoring to the current governance model and capability surfaces.

**Rewrite target:**

- define usage evidence as an input to the current governance loop
- make it explicit that:
  - used context
  - used skills
  - used hooks/commands/schedules
    are evidence classes feeding existing governance, not a new independent telemetry subsystem

### `#135` Session Recall vs Durable Memory/Profile

**Decision:** Close or heavily rewrite; default recommendation is close.

**Why:**

This issue is the most likely to conflict with the architecture already on `main`.

Its current framing strongly suggests a parallel session-recall subsystem with new archive object families. That competes with the already-landed session model:

- timeline
- working context
- checkpoints

That makes it the riskiest issue to leave open unchanged.

**Preferred action:**

- close it with a migration comment explaining that the underlying concern remains valid
- redirect future work into:
  - existing session artifact/query surfaces
  - assembly/retrieval issues
  - follow-up work on current session surfaces rather than a parallel archive subsystem

**Alternative if closure is undesirable:**

- rewrite it drastically so it no longer proposes a competing session subsystem

## GitHub Actions Plan

After review, perform the following issue operations:

### Edit in place

- `#125`
- `#127`
- `#132`
- `#134`
- `#137`

For each:

- revise title if needed
- rewrite body to align with the current architecture
- keep existing issue number
- preserve epic linkage

### Close with migration comment

- `#135`

Comment should explain:

- the concern is acknowledged
- the current wording conflicts with the already-landed session artifact model
- follow-up work should happen through the current session/runtime/assembly path instead

### Cross-linking

Add explicit links among:

- `#134` lifecycle contract
- `#137` compaction formalization
- `#125` extraction/profile operations
- `#132` usage evidence / session-to-memory loop
- `#127` connector-first ingestion

The point is to clarify that these are adjacent workstreams inside the same runtime architecture, not independent subsystem proposals.

## Label And Comment Policy

### Labels

Keep existing priority/architecture labels unless a specific issue now clearly belongs elsewhere.

Do not introduce a new taxonomy in this pass.

### Migration comments

Each substantially rewritten issue should receive a short migration note comment explaining:

- the issue was updated to match the architecture now merged on `main`
- the governance model is built around three stable identities and the dual-loop runtime
- future work on this issue is expected to extend the current implementation, not replace it with a parallel subsystem

## Rollout Strategy

Do the issue realignment in a single pass after this design is approved.

Recommended order:

1. rewrite `#134`
2. rewrite `#137`
3. rewrite `#125`
4. rewrite `#132`
5. rewrite `#127`
6. close or drastically rewrite `#135`
7. add cross-links and migration comments

This order moves from the most central runtime-contract issues outward toward ingestion and recall language.

## Success Criteria

The realignment is successful when:

- no open issue in this cluster implies a parallel architecture that conflicts with `main`
- open issues clearly extend the current three-identity, dual-loop model
- future implementation can be delegated from issue text without re-litigating the architecture
- the tracker becomes a reliable roadmap for the Context Engine, rather than a mix of old and new conceptual models
