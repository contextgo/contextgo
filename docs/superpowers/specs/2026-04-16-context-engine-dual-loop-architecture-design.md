# Context Engine Dual-Loop Architecture Design

Date: 2026-04-16

## Goal

Freeze the architecture and boundary rules for ContextGo's next-stage Context Engine so that:

- project-local context remains the real source of truth for agents working inside a project
- background context governance becomes systematic instead of ad-hoc
- session, project, and space context can evolve continuously without turning into a hidden black-box database
- the product can move toward a native AI workbench for ordinary users

This spec intentionally focuses on architecture constraints and data flow boundaries.

It does **not** define the full implementation details of internal skill bundles, prompt templates, or job payload schemas. Those are follow-up design topics after this boundary is locked.

## Product Position

ContextGo is a desktop-first, local-first, multi-agent work system.

Its Context Engine should not behave like an isolated memory database beside the product. It should manage context through the vault-backed workspace layout already owned by ContextGo.

The user-facing project context must stay editable, inspectable, and versionable in normal project files.

## Hard Source-Of-Truth Rule

Project-local context is the final source of truth for project execution.

That means agents working inside a project should directly consume project files such as:

- `AGENTS.md`
- `docs/`
- `skills/`
- project working notes
- project capability surfaces for hooks, commands, and schedules

The Context Engine does not replace these files with a hidden engine-only truth.

Instead:

- vault-backed project and session files hold project-visible context truth
- the engine holds cross-boundary governance state, long-horizon memory, timing and expiration state, and promotion metadata

## Workspace Boundary

The core workspace boundary is:

- `space -> vault root`
- `project -> project root`
- `session -> project-root session area`

The Context Engine manages context through this vault-backed layout, not beside it.

### Space Scope

The vault root owns space-level context surfaces such as:

- cross-project notes
- space memory digests
- user profile and long-horizon context projections
- connector-derived space summaries

### Project Scope

The project root owns project execution context surfaces such as:

- `AGENTS.md`
- `docs/`
- `skills/`
- project working notes
- capability review notes for hooks, commands, and schedules

### Session Scope

Session context lives under the project root as a project-scoped runtime context layer.

It owns:

- session timeline
- session working context
- session checkpoints

## Dual-Loop Architecture

The Context Engine runs as a single orchestration core with two formal loops.

### Session Loop

Purpose:

- capture what is happening now
- keep current task context useful
- prepare future injection for the next turns

Outputs:

- `session timeline`
- `session working context`
- `session checkpoints`

### Project / Space Evolution Loop

Purpose:

- detect stable signals from session work
- evolve project context files
- distill cross-session and cross-project memory
- keep connector-derived context flowing into useful product surfaces

Outputs:

- project docs updates
- `AGENTS.md` proposals
- skill update proposals
- space-level digests
- user profile and cross-project pattern memory

## Runtime Structure

The runtime shape is:

- one `Context Orchestrator`
- three fixed context-governance identities
- many ordinary role assistants

The product must **not** expose a large set of background context assistants to users.

## Governance Identities

### 1. Session Steward

Responsibilities:

- append session facts to timeline
- rewrite session working context
- generate stable checkpoints on key events
- provide the nearest reusable context for runtime injection

Primary write scope:

- session timeline
- session working context
- session checkpoints

### 2. Project Curator

Responsibilities:

- lift stable session results into project docs
- maintain project-level context quality
- propose `AGENTS.md` updates
- propose skill updates based on actual usage evidence
- summarize project-level capability behavior

Primary write scope:

- project docs
- project working notes
- project capability review notes

Proposal scope:

- `AGENTS.md`
- `skills/`
- hooks / commands / schedules behavior proposals

### 3. Space Curator

Responsibilities:

- maintain cross-session and cross-project memory
- build user profile and long-horizon patterns
- manage timing, staleness, and expiration state
- digest connector-derived context into space-level context

Primary write scope:

- space-level docs
- engine-held profile and long-horizon memory
- connector digests

Downstream proposal scope:

- project-level promotion candidates

## Internal Implementation Rule

The implementation may use more than three internal assistant packages, skill bundles, or worker profiles.

However:

- product-visible governance identities stay fixed at three
- internal helper agents are implementation detail only
- non-user-facing context agents must not appear in the normal assistant catalog

User-visible control should be provided through a dedicated runtime console, not a large assistant list.

## User-Facing Runtime Console

The settings surface should expose a dedicated Context Engine runtime console showing:

- whether Context Engine automation is enabled
- recent context jobs
- which governance identity ran each job
- proposals, accepted updates, and rejected updates
- failed jobs and retry state
- schedule and hook activity
- connector digestion activity

The user should see governance and control, not a zoo of background assistants.

## Session Context Model

Session context uses a split-document model.

### Session Timeline

Characteristics:

- append-only
- time-ordered
- factual, not optimized for prompt quality
- suitable for archival and replay

Example event classes:

- user query started
- assistant reply completed
- user interruption
- tool result recorded
- skill execution recorded
- checkpoint created

### Session Working Context

Characteristics:

- continuously rewritten
- optimized for current usefulness
- combines active goal, constraints, pending work, and active references
- not equal to "recent chat history"

It is a moving attention window, not a pure time window.

### Session Checkpoints

Characteristics:

- generated at important boundaries
- stable enough to feed project and space evolution
- not rewritten after emission

Suggested checkpoint triggers:

- interruption
- strategy shift
- compaction trigger
- milestone reached
- idle-interval boundary
- explicit close or flush

## Automation Trigger Model

The orchestration core uses a mixed trigger model:

- hooks for near-real-time fact capture
- schedules for periodic maintenance
- commands for explicit user-triggered governance actions
- typed context events for internal routing

Three fixed identities are invoked by job type.

They are not permanently free-running background chats.

## Connector Context Rule

Connector-derived context must enter the same flow system.

Every connector input should be classified into one or more of:

- session-relevant
- project-relevant
- space-relevant

Connector raw material should not be dumped directly into prompts by default.

It should first be digested into:

- session working context when immediately relevant
- project docs or notes when project-stable
- space-level digest or memory when cross-project durable

## Writeback Levels

All automated writeback is classified into four levels.

### Level 0: Fact Append

Append-only, low risk, full automation.

Examples:

- session timeline
- checkpoints
- runtime history
- connector raw digest log
- skill usage log

### Level 1: Working Context Rewrite

Rewritable, task-focused, fully automated.

Examples:

- session working context
- project working notes
- active task summaries

### Level 2: Project Documentation Curation

Stable project-facing docs, automatically writable with guardrails.

Examples:

- decision notes
- workflow notes
- connector integration notes
- project memory digest docs

### Level 3: Rule / Capability Surface Evolution

Higher risk, proposal-first by default.

Examples:

- `AGENTS.md`
- `skills/`
- hooks / commands / schedules behavior proposals

## Special Rules For AGENTS.md

`AGENTS.md` is both:

- an execution entry
- a project rule surface
- a context index

By default, only these proposal classes are allowed:

- index completion
- stable rule addition
- context entry routing changes

Default disallowed automatic changes:

- broad style rewrites
- deleting existing rules
- large structural reorganization
- adding heavy persona text unrelated to project execution

## Special Rules For Skills

Skill evolution should start from evidence, not direct mutation.

Three output classes are allowed:

- usage evidence note
- skill patch proposal
- new skill candidate

Default automation should stop before direct mutation of formal skill content.

## Injection Strategy

Injection should assemble context in five layers.

### Layer 1: Session Active Context

Includes:

- session working context
- recent checkpoint conclusions
- active constraints
- pending work

Priority:

- highest

### Layer 2: Project Core Context

Includes:

- relevant `AGENTS.md` guidance
- relevant project docs
- relevant skill summaries
- project capability notes

Priority:

- second

### Layer 3: Space / User Long-Horizon Context

Includes:

- user profile
- cross-project stable patterns
- long-horizon preferences

Priority:

- third

### Layer 4: Connector-Derived Context

Includes:

- current external context digests
- connector summaries relevant to the task

Priority:

- fourth, unless promoted by strong task relevance

### Layer 5: Skill / Capability Evidence

Includes:

- concise hints about recommended skill usage
- common failure reminders
- command / schedule / hook context hints

Priority:

- auxiliary only

### Trimming Order

Trim in this order:

1. connector-derived context
2. space / user long-horizon context
3. non-core project docs
4. capability evidence
5. session active context last

This protects "what am I doing now?" and "what does this project require?" from being crowded out.

## Query Modes

Not every turn should load the full five-layer stack.

Define three runtime modes:

- `quick turn`
  - minimal session + minimal project rules
- `task turn`
  - session + project + selective space
- `deep work turn`
  - full five-layer assembly with stronger connector and capability participation

## Relationship To Existing ContextGo Architecture

This design extends and sharpens current ContextGo direction rather than replacing it.

It is consistent with:

- `Space` as the product-level boundary
- event-driven Context Engine maintenance
- project-local vault surfaces
- runtime-neutral capability ownership for skills, hooks, commands, and schedules

It rejects:

- replacing `Space` with a filesystem-first product model
- turning Context Engine into a user-facing catalog of many background assistants
- letting hidden engine state replace project files as execution truth

## Non-Goals

This spec does not yet define:

- the detailed skill bundles loaded by each governance identity
- concrete assistant package manifests for internal context-governance helpers
- exact job payload schemas for each automation path
- exact vault path naming for the new session files
- approval UX details for Level 3 proposals

Those are follow-up design topics after this architecture boundary is accepted.

## Acceptance Criteria

This architecture should be considered accepted when all of the following are true:

- project-local files remain the final project execution truth
- the Context Engine operates through vault-backed directories instead of beside them
- dual-loop behavior is explicitly modeled
- governance identities are fixed at `Session Steward`, `Project Curator`, and `Space Curator`
- users see a Context Engine runtime console instead of many background assistants
- writeback levels are explicit
- injection order is explicit
- connector context is part of the same flow model

## Recommended Next Design Topic

After this spec is accepted, the next design should define:

- how `Session Steward`, `Project Curator`, and `Space Curator` load and switch skill bundles
- how hooks, schedules, and commands map onto concrete context job types
