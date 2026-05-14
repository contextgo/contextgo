# Design: Agent Team Workflow Mode

**Date:** 2026-03-28
**Status:** Draft

## Background

The current discussion group feature already introduced the right runtime chassis for multi-agent
collaboration:

- one parent `group` conversation
- multiple hidden child conversations
- one shared workspace
- one orchestrator above existing agent runtimes

That architecture is strong enough for more than discussion.

However, the current product semantics are still discussion-first:

- independent or semi-independent replies
- projected participant messages in one timeline
- simple round-based prompting
- no persistent execution contract beyond `mode + rounds`

This works for "compare opinions" and "let several agents debate", but it is not enough for a
long-running production workflow such as:

- planner defines the target and acceptance criteria
- writer executes against a draft or artifact
- evaluator critiques the result with an explicit rubric
- the team loops until a threshold is reached or budget is exhausted

That workflow is closer to an agent team than a discussion room.

## Goal

Add a new default collaboration workflow inspired by planner / generator / evaluator harnesses,
while preserving reuse of the existing parent-child conversation architecture.

The new workflow should support:

- a shared workspace for all participants
- long-running iterative execution
- explicit participant roles
- evaluator-led quality gates
- structured handoff between loops
- resumable run state instead of one-shot discussion rounds

## External Reference Distillation

The downloaded HTML reference is useful for its harness ideas, not for its visual presentation.
For this repository, the right move is to absorb the method into our existing workflow design notes instead of vendoring a style-heavy HTML artifact.

### What Is Worth Keeping

- The two core failure modes are `context anxiety` and `self-evaluation bias`.
- Context anxiety means long-running agents gradually lose coherence as context grows, so the system needs explicit reset and handoff mechanisms instead of assuming one child session can run forever.
- Self-evaluation bias means the same agent that produced the work is a weak judge of its own quality, especially for subjective outputs such as design, writing, and UX.
- The structural response is a role split: one agent produces, another evaluates, and the evaluator stays skeptical by design.
- Evaluation should use an explicit rubric with thresholds and actionable revision points rather than free-form praise or vague critique.
- For artifact work, evaluation should inspect the artifact or running system directly, not just the transcript describing it.
- The planner / generator / evaluator pattern is useful, but the important part is the contract between roles, not the exact names.
- Every harness component encodes a bet about current model weaknesses, so the harness should be simplified when stronger models make a scaffold non-load-bearing.

### Product Mapping For ContextGo

- In ContextGo terms, the article's `generator` maps more naturally to `writer` or `builder`, depending on artifact type.
- Workflow mode should remain artifact-first rather than transcript-first.
- The parent group session should persist stage, iteration count, latest evaluator score, latest decision, artifact path, and handoff snapshots.
- Child-session renewal should be a first-class workflow tool so the system can reset context without losing the execution thread.
- Evaluator output should be structured enough to either stop the run cleanly or feed the next revision loop.
- Planner, writer, and evaluator should align on a concrete acceptance contract before the writer starts a loop whenever the task has non-trivial ambiguity.

### Repository Storage Decision

- Keep the distilled lessons in repository docs.
- Do not store the original HTML file in the repo because its styling is not the key asset.

## Recommendation

Do **not** model this as "just another discussion mode" at the product level.

Also do **not** throw away the current `group` conversation implementation.

The best near-term split is:

### 1. Keep `group` as the session container

`group` already gives us the correct runtime boundary:

- one parent session
- multiple child agent sessions
- one shared workspace
- nested history and tab behavior
- stop / delete / workspace migration handling

This should remain the durable conversation container.

### 2. Split orchestration into two families

Inside `group`, distinguish between:

- `discussion` orchestration
- `workflow` orchestration

`discussion` keeps the existing `broadcast / relay / debate` semantics.

`workflow` becomes the new team-style execution model with explicit roles and iteration budgets.

This avoids a large migration while giving the product a cleaner conceptual boundary:

- a `group` is the collaboration container
- an orchestration recipe defines how the group behaves

## Why Not Keep Everything Under "Discussion Group"

The planner / writer / evaluator pattern differs from discussion mode in several fundamental ways.

### 1. Success is artifact-based, not reply-based

Discussion mode optimizes for a readable timeline of opinions.

Workflow mode optimizes for a deliverable:

- a draft
- a plan
- a spec
- a set of files in the workspace

### 2. Roles are asymmetric

Discussion participants are peers.

Workflow participants are not peers:

- planner defines the target
- writer produces or revises the artifact
- evaluator judges quality and requests changes

### 3. Loops need durable state

Discussion mode can finish after one or two rounds.

Workflow mode needs:

- iteration counters
- stop conditions
- score thresholds
- resumable stages
- structured handoff records

### 4. Tool permissions should differ by role

In a workflow team, the writer may be allowed to edit while the evaluator should usually remain
read-only. That is a policy model, not a discussion prompt model.

## Proposed Product Model

### Collaboration Session

Retain the existing `group` conversation as the top-level collaboration session.

Suggested shape:

```ts
type GroupOrchestrationKind = 'discussion' | 'workflow';

type GroupOrchestration =
  | {
      kind: 'discussion';
      mode: 'broadcast' | 'relay' | 'debate';
      rounds: 1 | 2;
    }
  | {
      kind: 'workflow';
      template: 'planner-writer-evaluator';
      maxIterations: number;
      scoreTarget?: number;
      artifactPath?: string;
    };
```

### Participant Role

Add an optional explicit role for workflow orchestration:

```ts
type GroupParticipantRole = 'planner' | 'writer' | 'evaluator' | 'custom';
```

Discussion groups can ignore this field.

Workflow groups depend on it.

### Run State

Add persisted runtime state on the parent group conversation:

```ts
type WorkflowRunState = {
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  iteration: number;
  stage: 'planning' | 'writing' | 'evaluating' | 'handoff' | 'finalizing';
  latestScore?: number;
  latestDecision?: 'continue' | 'accept' | 'stop';
  artifactPath?: string;
  activeParticipantId?: string;
};
```

Without this, the system cannot safely resume or explain a long-running team run.

## New Default Workflow

For the first workflow template, use:

`Planner + Writer + Evaluator`

### Planner

Responsibilities:

- turn user intent into a concrete objective
- define success criteria
- define revision targets for the writer
- decide whether the work should continue when the evaluator feedback is ambiguous

### Writer

Responsibilities:

- produce or revise the artifact in the shared workspace
- respond to planner direction and evaluator feedback
- keep progress grounded in the artifact, not in meta-discussion

### Evaluator

Responsibilities:

- assess the artifact against an explicit rubric
- return a score plus actionable criticism
- resist praise bias
- decide whether the current output passes the threshold

## What The Current System Already Has

The existing discussion-group implementation already covers a surprising amount of ground.

### Reusable Today

- parent `group` session type
- hidden child conversation creation
- participant metadata and child-session mapping
- shared workspace propagation
- parent timeline projection
- stop / delete / migration of the whole family
- sidebar nesting and tab family behavior

### Reusable With Light Refactor

- participant picker UI
- participant avatars and labels
- parent renderer shell
- projected per-participant message headers
- child-session lifecycle management

## What Is Missing For Team Workflow

### 1. Orchestration Kind Split

Current code only stores discussion-flavored orchestration metadata.

Missing:

- a formal split between discussion and workflow orchestration
- backward-compatible normalization for old group data

### 2. Role Semantics

Current participants only know identity metadata.

Missing:

- explicit workflow role per participant
- default role presets
- role-aware prompt builders

### 3. Durable Stage Machine

Current runs are one-shot and loop only in-memory during a single `sendMessage` call.

Missing:

- persisted workflow stage
- persisted iteration number
- resumable workflow runs
- pause / resume semantics

### 4. Artifact-Centric Handoff

Current system passes text summaries between agents.

Missing:

- canonical artifact path
- structured handoff object
- explicit planner brief
- evaluator report format

For writing workflows, handoff should be artifact-first, not transcript-first.

### 5. Evaluator Rubric

Current debate second-round prompts have no formal scoring model.

Missing:

- rubric schema
- score normalization
- pass / fail threshold
- explicit revision instructions

Suggested first rubric fields for writing:

- goal adherence
- clarity
- structure
- originality
- factual caution

### 6. Role-Specific Tool Policy

Current group flow reuses ordinary child runtimes and does not impose role policy.

Missing:

- writer can edit
- planner mostly read-only
- evaluator read-only by default
- explicit rejection path when a forbidden role attempts edits

### 7. Context Reset / Child Session Renewal

The harness insight about context anxiety matters here.

Missing:

- a way to retire a child session after several loops
- a structured handoff to a fresh child session
- lineage tracking from old child to renewed child

Without this, long-running workflows will degrade as child contexts bloat.

### 8. Background-Run UX

Current group execution behaves like a blocking reply.

Missing:

- visible stage indicator
- iteration progress
- current owner participant
- pause / resume / stop controls
- final acceptance summary

### 9. Observability

Current parent timeline is readable but not operationally rich enough.

Missing:

- workflow event messages
- score cards
- contract snapshots
- artifact checkpoints
- iteration summaries

## Suggested MVP Scope

The first workflow implementation should stay narrow.

### Template

- only `planner-writer-evaluator`

### Artifact Type

- one workspace draft target
- default file path such as `team-output.md`

### Loop Budget

- default `maxIterations = 3`

### Evaluator Output

- score `0-10`
- pass threshold default `>= 8`
- 3 to 5 actionable revision points

### Tool Policy

- writer: read + write
- planner: read-only
- evaluator: read-only

### Stop Conditions

- evaluator score reaches threshold
- max iterations reached
- user stops run

## Implementation Plan

### Phase 1. Generalize the Parent Container

Update shared types and normalizers so a `group` can host either discussion or workflow
orchestration.

Likely files:

- `src/common/config/storage.ts`
- `src/common/adapter/ipcBridge.ts`
- `src/process/services/ConversationServiceImpl.ts`
- `src/renderer/pages/conversation/utils/createConversationParams.ts`

### Phase 2. Add Workflow Orchestrator

Introduce a workflow orchestrator alongside the existing discussion flow.

Prefer file layout such as:

- `src/process/bridge/services/group/`
- `src/process/bridge/services/group/discussion/`
- `src/process/bridge/services/group/workflow/`

That keeps the current feature and the new one as siblings under one parent domain.

### Phase 3. Add Workflow Template

Implement `planner-writer-evaluator` with:

- role-aware prompt builder
- iteration controller
- evaluator rubric parser
- pass / continue decision logic

### Phase 4. Add Workflow UI

Expose:

- new create option in group modal
- workflow-specific default selection
- run-state panel
- iteration and score cards

## Concrete Recommendation

Short version:

- keep the existing `group` conversation type
- stop treating every group orchestration as a discussion
- add a second orchestration family called `workflow`
- make `planner-writer-evaluator` the new default workflow template
- keep "discussion group" as one collaboration template, not the whole concept

This gives ContextGo a cleaner path:

- ad hoc comparison stays in discussion mode
- long-running production work moves into workflow mode

That is a better fit than stretching discussion semantics until they accidentally become a team
runtime.
