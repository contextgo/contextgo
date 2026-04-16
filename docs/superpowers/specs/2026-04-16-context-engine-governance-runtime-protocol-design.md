# Context Engine Governance Runtime Protocol Design

Date: 2026-04-16

## Goal

Define the runtime protocol for how ContextGo's fixed governance identities are assembled, triggered, and observed.

This spec builds on the already accepted dual-loop architecture and freezes:

- how `Session Steward`, `Project Curator`, and `Space Curator` load skills
- how hooks, schedules, and commands trigger governance work
- how governance jobs are routed and observed
- how internal implementation detail stays hidden behind stable product-visible identities

This spec does **not** define the exact prompt text or the final list of individual packaged skills. It defines the protocol and boundaries that those assets must follow.

## Architectural Base

This document assumes the following architecture is already fixed:

- project-local files remain the final project execution truth
- Context Engine operates through vault-backed project and space layout
- session and project/space evolution run as a dual-loop system
- governance identities are fixed at:
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- user-facing control is exposed through a runtime console instead of a large list of background assistants

## Runtime Model

The governance runtime has four layers:

1. `Context Orchestrator`
2. fixed governance identities
3. internal skill bundles
4. trigger surfaces (`hooks`, `schedules`, `commands`, and connector ingress)

Only the orchestrator routes work.

Only the three fixed identities are product-visible governance roles.

Internal helper agents, worker profiles, or package variants may exist, but they remain implementation detail only.

## Fixed Governance Identities

### Session Steward

Purpose:

- manage current-session context quality
- keep current task context reusable
- supply the nearest session-side injection material

Primary work products:

- session timeline
- session working context
- session checkpoints

### Project Curator

Purpose:

- evolve project-local context files
- turn stable session outputs into project documentation and proposals
- track capability drift for project-owned skills, hooks, commands, and schedules

Primary work products:

- project docs updates
- project working notes
- project capability review notes
- `AGENTS.md` proposals
- skill update proposals

### Space Curator

Purpose:

- maintain cross-session and cross-project context
- digest connector-derived context into durable higher-level forms
- manage profile, timing, staleness, and expiration state

Primary work products:

- space-level docs
- user profile projections
- cross-project pattern summaries
- connector digests
- temporal memory governance state

## Skill Assembly Protocol

Fixed governance identities do not rely on one giant prompt.

They run through explicit skill assembly.

Every execution must be composed from the following four layers.

### Layer A: Identity Base Rules

Stable rules defining:

- allowed write scope
- proposal vs direct-write behavior
- expected output style
- forbidden targets

Examples:

- `Session Steward` cannot directly mutate project `AGENTS.md`
- `Project Curator` defaults to proposal-first for `AGENTS.md` and `skills/`
- `Space Curator` cannot directly overwrite active project session files

Identity base rules are long-lived and should change rarely.

### Layer B: Role Core Skills

Long-lived core skill bundles always loaded for a governance identity.

#### Session Steward core skills

- `session-timeline-writer`
- `session-working-context-rewriter`
- `session-checkpoint-distiller`
- `session-injection-preparer`
- `task-state-summarizer`
- `constraint-window-manager`

#### Project Curator core skills

- `project-doc-curation`
- `project-decision-promoter`
- `agents-index-updater`
- `skill-usage-review`
- `capability-surface-mapper`
- `project-context-patch-generator`

#### Space Curator core skills

- `user-profile-distillation`
- `cross-project-pattern-synthesis`
- `temporal-memory-governance`
- `connector-context-digestion`
- `space-context-promotion`
- `expiration-and-staleness-manager`

The exact implementation files may evolve, but the protocol assumes that each governance identity has a small stable core skill set.

### Layer C: Job-Specific Skills

Additional skills are loaded based on job type.

Examples:

- `session_compaction`
  - `compaction-summarizer`
  - `pending-task-detector`
  - `active-constraint-extractor`
- `project_promotion`
  - `project-doc-patcher`
  - `decision-note-writer`
- `project_capability_curation`
  - `skill-usage-analyzer`
  - `agents-index-patcher`
  - `capability-review-note-writer`
- `space_memory_distillation`
  - `user-profile-merger`
  - `cross-project-pattern-builder`
- `connector_digest`
  - `connector-event-normalizer`
  - `external-context-classifier`

Job-specific skill bundles must be explicit and deterministic.

### Layer D: Contextual Augmentation Skills

These are dynamically selected from durable project or space context.

Sources may include:

- project-scoped context skills in project `skills/`
- space-promoted context skills
- future engine-owned context skill packages derived from durable patterns

Contextual skills are loaded only when they match:

- project
- space
- connector kind
- capability kind
- recent signal kinds
- job payload type

Contextual augmentation must never be silent or opaque.

Each selection must be recorded as part of the job execution snapshot.

## Skill Sources

Governance skill assembly may only use three source classes:

1. `system packaged skills`
2. `project-scoped context skills`
3. `space-promoted context skills`

The runtime must not silently scan arbitrary runtime-native directories and treat them as implicit governance skill sources.

The canonical ownership model remains:

- project-local capability files for project truth
- package-managed skills for reusable execution units
- runtime-native projections as projections only

## Skill Selection Rules

Selection is a three-step process:

1. load identity base rules and role core skills
2. expand with job-specific skills
3. augment with matching project or space context skills

The selection algorithm should optimize for:

- determinism
- small active skill sets
- explainability
- bounded write scope

The selection algorithm should avoid:

- broad opportunistic overloading of all available skills
- hidden prompt inflation
- project contamination from unrelated space or global context

## Execution Snapshot Requirement

Every governance job execution must record a snapshot containing:

- governance identity
- job type
- trigger source
- loaded core skills
- loaded job-specific skills
- loaded contextual augmentation skills
- contextual-selection rationale
- write scope
- whether the run produced direct writes or proposals

This snapshot must be available to the runtime console.

## Trigger Protocol

All governance activity starts from a trigger surface, but trigger surfaces are intentionally limited.

Allowed trigger classes:

- hooks
- schedules
- commands
- connector ingress

Trigger surfaces do not directly rewrite context files.

They only produce normalized facts or explicit requests.

The orchestrator translates those into typed context jobs.

## Hook Protocol

### Purpose

Hooks capture near-real-time execution facts and emit lightweight governance signals.

### Allowed hook categories

#### Session lifecycle hooks

Examples:

- turn started
- turn completed
- user interruption
- resume
- tool finished
- skill finished

Default routing:

- `Session Steward`

Typical emitted jobs:

- `session_fact_append`
- `session_working_context_refresh`
- `session_checkpoint_create`
- `session_signal_detect`

#### Project capability hooks

Examples:

- repeated skill invocation
- repeated command use
- repeated hook block or warning
- repeated schedule success or failure

Default routing:

- `Project Curator`

Typical emitted jobs:

- `project_capability_curation`
- `skill_usage_digest`
- `agents_patch_proposal`

#### Connector ingress hooks

Examples:

- external resource synced
- external message ingested
- repository activity captured
- browser or clipboard import completed

The orchestrator must classify connector input into:

- session-relevant
- project-relevant
- space-relevant

The resulting job is then routed to:

- `Session Steward`
- `Project Curator`
- `Space Curator`

depending on classified relevance.

### Hook limitations

Hooks may:

- capture facts
- normalize small payloads
- attach evidence references
- enqueue jobs

Hooks may not:

- directly rewrite docs
- directly mutate `AGENTS.md`
- directly mutate formal project skills
- perform large summarization work

## Schedule Protocol

### Purpose

Schedules drive slow-loop distillation, maintenance, and expiration.

### Schedule classes

#### Short-cycle schedules

Recommended cadence:

- every 5-15 minutes
- or idle-window based

Default routing:

- `Session Steward`

Typical jobs:

- `session_working_context_refresh`
- `session_checkpoint_create`
- `session_compaction`

#### Project maintenance schedules

Recommended cadence:

- hourly
- half-daily
- daily

Default routing:

- `Project Curator`

Typical jobs:

- `project_doc_curation`
- `project_promotion`
- `project_capability_curation`
- `agents_patch_proposal`
- `skill_patch_proposal`

#### Space distillation schedules

Recommended cadence:

- nightly
- daily
- weekly

Default routing:

- `Space Curator`

Typical jobs:

- `space_memory_distillation`
- `user_profile_refresh`
- `cross_project_pattern_synthesis`
- `connector_digest`
- `temporal_memory_expiration`

### Schedule limitations

Schedules should be used for:

- consolidation
- distillation
- expiration
- proposal batch generation

Schedules should not be used for:

- ultra-low-latency turn injection
- heavy project-truth mutation at arbitrary high frequency
- operations requiring immediate conversational feedback

## Command Protocol

### Purpose

Commands provide explicit user-triggered governance control.

Commands let users trigger governance without needing to understand internal hooks or schedules.

### Command classes

#### Session commands

Examples:

- `/context-session-refresh`
- `/context-session-checkpoint`
- `/context-session-compact`

Default routing:

- `Session Steward`

#### Project commands

Examples:

- `/context-project-curate`
- `/context-project-propose-agents`
- `/context-project-review-skills`

Default routing:

- `Project Curator`

#### Space commands

Examples:

- `/context-space-distill`
- `/context-space-profile-refresh`
- `/context-space-digest-connectors`

Default routing:

- `Space Curator`

### Command limitations

Commands may:

- force a governance run
- specify target scope
- specify conservative / standard / aggressive mode later if needed
- return report, proposal, or update result

Commands may not:

- bypass writeback boundaries
- bypass runtime-console history
- invoke an arbitrary hidden background assistant outside the governance protocol

## Trigger-To-Job Conversion Rule

A hard protocol rule:

**triggers describe what happened; jobs describe what should be done**

Examples:

- repeated skill failures do not directly mutate a skill file
- they emit evidence
- the orchestrator converts that into `project_capability_curation`

- accumulated connector imports do not directly rewrite profile
- they emit digested relevance facts
- the orchestrator converts that into `connector_digest` or `space_memory_distillation`

This preserves:

- stable trigger surfaces
- evolvable job policy
- clean governance identity boundaries

## Job Type Ownership

The default ownership map is:

### Session Steward-owned jobs

- `session_fact_append`
- `session_working_context_refresh`
- `session_checkpoint_create`
- `session_compaction`
- `session_injection_prepare`

### Project Curator-owned jobs

- `project_doc_curation`
- `project_promotion`
- `project_capability_curation`
- `agents_patch_proposal`
- `skill_patch_proposal`

### Space Curator-owned jobs

- `space_memory_distillation`
- `user_profile_refresh`
- `cross_project_pattern_synthesis`
- `connector_digest`
- `temporal_memory_expiration`

## Runtime Console Requirements

The runtime console must be able to answer, for every governance execution:

- what triggered it
- what job was created
- which governance identity ran it
- what skills were loaded
- what files or surfaces were written
- what outputs were proposals only
- what failed and why

The runtime console is not optional decoration.

It is the main explainability boundary for governance automation.

## Relationship To Existing ContextGo Runtime Surfaces

This protocol must compose with existing ContextGo product capabilities:

- assistant packages
- project-local `.contextgo` automation files
- project capability mirrors into the space vault
- typed context events
- queued context jobs

The protocol should reuse those surfaces rather than inventing a second automation model.

## Default Mutation Strategy

For now, project-level mutation stays simple:

- project docs: default automatic write allowed
- `AGENTS.md`: append-first, incremental patch strategy
- `skills/`: append-first, incremental patch strategy

This spec intentionally avoids defining a detailed "low-risk auto-approve patch" taxonomy for `AGENTS.md` or `skills`.

That can be added later if needed.

## Non-Goals

This document does not yet define:

- the exact package IDs or manifest layout for internal governance helpers
- the final list of packaged skills per governance identity
- the final command naming exposed to users
- approval UX for proposal review
- exact vault path naming for session timeline and checkpoint files

## Acceptance Criteria

This runtime protocol should be considered accepted when:

- governance identities remain fixed at three
- internal implementation can be finer-grained without changing product-visible identities
- skill assembly is explicit and layered
- hooks, schedules, and commands all route through typed context jobs
- trigger surfaces do not directly rewrite project truth files
- runtime console observability is part of the contract
- project and space scoped context skills can augment governance execution without becoming implicit hidden prompt state

## Recommended Next Step

After this protocol is accepted, the next implementation-oriented plan should define:

- exact job schema additions
- exact vault path layout for session timeline / working context / checkpoints
- minimal packaged skills for each governance identity
- first runtime console panels and event views
