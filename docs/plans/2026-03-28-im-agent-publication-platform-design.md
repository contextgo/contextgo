# Design: IM-Native Agent Publication Platform

**Date:** 2026-03-28
**Status:** Proposed

## Background

AionUi already has the technical foundations for:

- multiple runtime backends (`gemini`, ACP-backed assistants, `codex`, `openclaw-gateway`)
- channel connectors for IM ingress
- durable conversations and task execution
- assistant definitions, hooks, skills, and workspace-aware runtimes

However, the current product language still leans toward:

`one user -> one assistant -> one personal session`

That framing is too narrow for the next product phase.

The stronger product opportunity is:

- one platform hosts many agents
- those agents can be published to many IM entry points
- the published surface may serve the creator, a group, a topic thread, or an entire enterprise
- IM is not only a remote control for the owner, but also a distribution surface for serving others

This direction is inspired by OpenClaw's routing model, but AionUi should not become "an OpenClaw shell".
Instead, AionUi should define a product model where OpenClaw is one runtime option inside a broader
agent publication platform.

## Problem

Today several concerns are still too tightly coupled:

1. IM ingress identity and runtime execution identity are mixed together.
2. "Agent selection" is still modeled too close to backend enums instead of published capabilities.
3. Group, topic, and tenant-scoped usage are not first-class product objects.
4. `/new` semantics are still understood mainly as "make another conversation", not "rotate runtime context while preserving publication".
5. UI still centers on connector configuration and per-platform defaults, instead of publication and audience routing.

As a result, the system can support "I talk to an assistant from Telegram", but not yet cleanly support:

- "I publish this agent to my team group"
- "this topic thread uses a different agent than the main group"
- "my enterprise owns the publication, but many employees use it"
- "the same published agent is exposed through Telegram, WeChat, and Feishu"

## Goal

Define AionUi as an **IM-native agent publication platform** with a clear separation between:

- IM ingress session
- agent runtime session
- reusable published agent capability
- routing and publication

The design must support:

- personal use
- group use
- topic/thread use
- enterprise-managed publication
- multiple runtime backends under one product model
- `/new` semantics that preserve publication while resetting runtime context

## Non-Goals

This document does not try to fully solve:

- store publishing and app-store distribution
- full billing and seat management
- full run-graph visualization for child runs in v1
- autonomous agent marketplaces
- replacing the existing single-user local conversation product

## Product Positioning

### What AionUi should be

AionUi should be the layer that:

- hosts many agent runtimes
- packages them into reusable published capabilities
- binds those capabilities to IM audiences
- isolates runtime sessions per audience
- lets users and organizations operate those publications safely

### What AionUi should not be

AionUi should not define itself as:

- a mobile wrapper around one coding agent
- a connector-specific bot management tool
- a UI that only forwards commands from phone to desktop

Those are implementation slices, not the product center.

## Core Product Principle

The platform must assume that an agent may serve **third-party audiences**, not only its creator.

That means the default mental model is:

`owner creates or publishes capability -> binds it to an audience -> audience interacts through IM`

not:

`owner logs into IM and remote-controls their private desktop assistant`

## Two Session Boundaries

This is the most important modeling decision.

### 1. IM Ingress Session

The IM ingress session answers:

- which connector/account received the message
- which audience the message belongs to
- whether the audience is authorized
- which publication binding applies

It is about **entry, identity, and routing**.

It should be stable even when the runtime conversation rotates.

### 2. Agent Runtime Session

The runtime session answers:

- which published agent currently handles this audience
- which conversation is active
- which root run is active
- which child runs exist
- what the current runtime state is

It is about **execution, context, and orchestration**.

It should be resettable without destroying publication.

### Required rule

`/new` resets the runtime session, not the ingress session and not the publication binding.

## Proposed Domain Model

## ConnectorAccount

Represents one real IM ingress endpoint.

Examples:

- one Telegram bot
- one WeChat service account
- one Feishu app for one enterprise
- one Discord bot for one workspace

Suggested fields:

- `id`
- `platform`
- `accountName`
- `tenantId`
- `credentials`
- `runtimeConfig`
- `status`
- `healthState`
- `createdAt`
- `updatedAt`

Responsibilities:

- authenticate with the IM platform
- receive and send messages
- expose account-level diagnostics
- act as the ingress boundary for routing

## Audience

Represents the target service surface.

Examples:

- one private user DM
- one group
- one channel
- one topic or thread inside a group
- one enterprise-level shared service scope

Suggested fields:

- `id`
- `connectorAccountId`
- `audienceType`: `direct_user | group | topic | channel | tenant_space`
- `remoteUserId`
- `remoteGroupId`
- `remoteTopicId`
- `displayName`
- `tenantId`
- `authorizationState`
- `metadata`
- `createdAt`
- `updatedAt`

Responsibilities:

- define who is being served
- define the routing scope
- provide the stable peer identity for publication

## PublishedAgent

Represents a reusable capability that can be exposed to audiences.

This is the product-level object users should select and publish.

It is not the same thing as a runtime backend.

Suggested fields:

- `id`
- `name`
- `description`
- `ownerId`
- `tenantId`
- `visibility`: `private | team | tenant | public_linked`
- `runtimeBackend`
- `modelPolicy`
- `promptProfile`
- `toolPolicy`
- `memoryPolicy`
- `delegationPolicy`
- `workspaceRef`
- `publishedFromConversationId`
- `version`
- `archived`
- `createdAt`
- `updatedAt`

Responsibilities:

- define the capability presented to users
- define runtime and orchestration policy
- define what is being published, independent of which IM platform exposes it

## PublicationBinding

Represents routing from an audience scope to a published agent.

Suggested fields:

- `id`
- `connectorAccountId`
- `audienceScopeType`: `connector_default | direct_user | group | topic | tenant_space`
- `audienceScopeKey`
- `publishedAgentId`
- `priority`
- `enabled`
- `bindingKind`: `durable | temporary_override`
- `fallbackPublishedAgentId`
- `activationPolicy`
- `createdAt`
- `updatedAt`

Responsibilities:

- decide who answers
- preserve publication independently from runtime resets
- support durable routing and temporary overrides separately

## IngressSession

Represents the stable route context for one audience on one connector account.

Suggested fields:

- `id`
- `connectorAccountId`
- `audienceId`
- `activeBindingId`
- `activeRuntimeSessionId`
- `state`
- `lastActivity`
- `metadata`

Responsibilities:

- bind ingress traffic to the current publication
- survive runtime session rotation
- maintain stable auditability for "which audience used which publication"

## RuntimeSession

Represents the current active execution context for one ingress session.

Suggested fields:

- `id`
- `ingressSessionId`
- `publishedAgentId`
- `activeConversationId`
- `rootRunId`
- `runtimeState`
- `workspaceRef`
- `createdAt`
- `lastActivity`
- `metadata`

Responsibilities:

- hold the active conversation
- hold the active root run
- rotate on `/new`
- isolate execution context per audience

## Run

Represents execution, including orchestration trees.

Suggested fields:

- `id`
- `runtimeSessionId`
- `parentRunId`
- `rootRunId`
- `backend`
- `conversationId`
- `status`
- `startedAt`
- `endedAt`
- `metadata`

Responsibilities:

- model root and child runs
- support OpenClaw-style orchestration safely
- support inspection and cancellation

## Naming Guidance

Product-facing naming should prefer:

- `Published Agent`
- `Audience`
- `Publication`
- `Runtime Session`

and avoid exposing backend-first language such as:

- "switch to Codex backend"
- "this Telegram chat is an OpenClaw session"

Users should publish a capability. The capability may internally run on OpenClaw, Codex, Gemini, or another runtime.

## Scenario Model

The product should explicitly support three classes of usage.

## Scenario A: Personal Remote Use

### Story

A user binds their private Telegram DM to a personal coding agent and uses it while away from the desktop.

### Logic

1. User connects a Telegram bot as a `ConnectorAccount`.
2. User pairs their DM as an `Audience` of type `direct_user`.
3. User selects one `PublishedAgent` named "My Coding Agent".
4. System creates a durable `PublicationBinding` for that audience.
5. First incoming message creates:
   - one `IngressSession`
   - one `RuntimeSession`
   - one active conversation
   - one root run
6. `/new` rotates only the runtime session context.

### Product expectation

This is the simplest case and should feel like "mobile continuation of my agent", but it must still use the same publication model as group use.

## Scenario B: Group-Published Service

### Story

A user publishes a release assistant into a team group so multiple teammates can ask deployment, summary, and troubleshooting questions.

### Logic

1. Owner creates a `PublishedAgent` named "Release Assistant".
2. Owner selects a group as `Audience`.
3. Owner binds the group to the published agent.
4. System applies the chosen activation policy:
   - all messages
   - mention only
   - keyword gated
   - approved members only
5. Group traffic enters through one stable `IngressSession`.
6. Runtime isolation is still per audience, not per sender.
7. Optional future feature:
   create per-member sub-context inside one group runtime policy.

### Product expectation

The group is the service surface. The owner is no longer the only beneficiary.

## Scenario C: Topic or Thread Publication

### Story

An enterprise uses one large support group, but different topics are served by different agents:

- one topic for release operations
- one topic for customer incidents
- one topic for architecture review

### Logic

1. Connector receives messages for one group and several topics.
2. Each topic becomes its own `Audience`.
3. Topics inherit from the parent group unless overridden.
4. A topic-level `PublicationBinding` can override the group-level binding.
5. `/new` resets only that topic's runtime session.

### Product expectation

Topics and threads must be first-class peers in the routing model. They cannot be reduced to plain group chat IDs.

## Scenario D: Enterprise-Managed Publication

### Story

An organization publishes an internal IT assistant and an engineering helper across multiple enterprise connectors.

### Logic

1. Organization owns `PublishedAgent` objects at tenant scope.
2. Admins manage `ConnectorAccount` objects per platform or department.
3. Admins bind audiences by org policy:
   - all employees DM -> IT Assistant
   - engineering groups -> Engineering Helper
   - incident war-room topics -> Incident Commander agent
4. Audit trail records:
   - which audience invoked which publication
   - which runtime session handled the request
   - which root run generated the result

### Product expectation

This is not a personal bot. It is an enterprise service surface.

## Scenario E: Temporary One-Time Override

### Story

In a group bound to "Release Assistant", the owner wants the current topic to use Codex only for one incident thread.

### Logic

1. Owner opens runtime controls for the topic.
2. Owner selects "Use another agent for this topic temporarily".
3. System creates a `PublicationBinding` with:
   - `bindingKind = temporary_override`
   - topic scope
4. The next runtime session uses the temporary binding.
5. `/new` clears the temporary override and falls back to the durable binding.

### Product expectation

Temporary overrides must be explicit and must not silently become permanent routing rules.

## Session Semantics

## First Message in an Unseen Audience

When a message arrives from a previously unseen audience:

1. resolve `ConnectorAccount`
2. resolve or create `Audience`
3. verify authorization / activation policy
4. resolve highest-priority `PublicationBinding`
5. load or create `IngressSession`
6. load or create `RuntimeSession`
7. load or create conversation and root run
8. dispatch to runtime

If no binding exists, the product should not silently guess forever. It should either:

- use one clearly visible connector default binding
- or enter a pending publication state and ask for admin action

## `/new` Semantics

`/new` should do the following:

1. terminate or interrupt the current root run
2. terminate or archive child runs if they exist
3. preserve the `IngressSession`
4. preserve the durable `PublicationBinding`
5. clear `temporary_override` if present
6. create a fresh conversation and root run
7. attach them to the same `RuntimeSession` or a rotated replacement session

`/new` should not:

- revoke authorization
- detach the audience from the published agent
- delete the audience object
- change connector ownership

## Switch Agent Semantics

The platform should expose two distinct actions:

### 1. Change Publication

"Bind this audience to another published agent"

Effects:

- durable routing change
- affects future runtime sessions
- preserved across `/new`

### 2. Use Temporarily

"Use another published agent for this session or topic once"

Effects:

- creates temporary override
- only affects current session slice
- cleared on `/new`

These must not be merged into one ambiguous "switch agent" button.

## Runtime Positioning of OpenClaw

OpenClaw should be treated as a runtime backend with strong orchestration support.

It is a good fit for:

- parent-agent coordination
- child-run delegation
- multi-step workflows
- tool-heavy or cross-agent reasoning

But it should sit under `PublishedAgent.runtimeBackend`, not above the publication model.

The same product model should also support:

- Codex-backed published agents
- Gemini-backed published agents
- Claude/ACP-backed published agents
- future internal workflow runtimes

## UI Design Direction

The UI should shift from "Channel Settings" to "Publication Operations".

Recommended top-level IA:

- Connectors
- Published Agents
- Audiences
- Publications
- Runtime Sessions
- Activity / Audit

## 1. Connectors

Purpose:

- manage connector accounts
- inspect health and diagnostics
- manage credentials and account-level activation rules

Main list columns:

- platform
- account name
- tenant
- status
- health
- bound audiences count
- active runtime count

Primary actions:

- connect account
- test connection
- view diagnostics
- view audiences

## 2. Published Agents

Purpose:

- create reusable capabilities
- publish from existing conversations
- define runtime and policy

Main list columns:

- name
- owner
- runtime backend
- visibility
- version
- publications count
- last used

Primary actions:

- create published agent
- publish from conversation
- duplicate
- archive
- inspect publications

### Published Agent detail page

Sections:

- Overview
- Runtime and model policy
- Prompt and memory policy
- Tool and delegation policy
- Published audiences
- Recent runtime sessions

## 3. Audiences

Purpose:

- inspect real service surfaces
- understand who is being served

Main list filters:

- connector
- audience type
- tenant
- authorization state
- publication state

Main list columns:

- display name
- type
- connector account
- current published agent
- activation policy
- last activity

Primary actions:

- bind published agent
- change activation policy
- pause audience
- view runtime session

## 4. Publications

Purpose:

- operate bindings as first-class routing contracts

This page should expose the routing table directly.

Main list columns:

- connector account
- audience scope
- published agent
- binding kind
- priority
- enabled
- fallback

Primary actions:

- create binding
- disable binding
- reorder priority
- create temporary override
- inspect inheritance

## 5. Runtime Sessions

Purpose:

- inspect current execution state
- operate `/new`, interrupt, handoff, and resume

Main list columns:

- audience
- published agent
- connector account
- current conversation
- root run
- runtime state
- last activity

Primary actions:

- open conversation
- interrupt current run
- `/new`
- handoff to another audience
- clear temporary override

## Core UI Flows

## Flow A: Publish from Existing Conversation

Entry:

- from conversation page
- action button: `Publish as Agent`

Wizard steps:

1. Name and description
2. Select visibility
3. Review runtime backend and model policy
4. Review prompt, tool, memory, delegation policy
5. Choose optional initial audiences
6. Confirm publication

Result:

- creates `PublishedAgent`
- optionally opens "Create Publication Binding" drawer

## Flow B: Bind a Group to an Agent

Entry:

- from Audience detail
- from Published Agent detail
- from Publications page

Drawer or modal fields:

- connector account
- audience
- published agent
- activation policy
- fallback policy
- binding kind
- priority

Confirmation summary should clearly say:

- who will be served
- which agent will answer
- whether this change is durable or temporary

## Flow C: Topic-Level Override

Entry:

- from Audience detail of a topic
- from Runtime Session detail

Actions:

- `Change publication`
- `Use temporarily for this topic`

UI copy must distinguish:

- affects future conversations
- affects only current session slice

## Flow D: `/new` from IM-Controlled Runtime

Entry:

- IM command
- runtime controls panel
- Audience detail quick action

Confirmation copy:

- "Reset current runtime context"
- "Keep current publication binding"
- "Clear temporary override if one exists"

This is more precise than "start a new conversation".

## Flow E: Enterprise Rollout

Entry:

- tenant admin panel

Steps:

1. create or choose published agent
2. choose connector accounts
3. choose target audiences by rule or direct selection
4. define activation policy
5. review audit scope and approval requirements
6. publish

## Interaction Principles

1. Always show the difference between:
   - audience
   - published agent
   - current runtime session
2. Never label a durable publication action as "session switch".
3. Never hide whether a change is temporary or durable.
4. Show topic/thread identity wherever supported.
5. Make runtime resets safe and predictable.
6. Make enterprise ownership visible in every management surface.

## Recommended Evolution from Current Resource Model

The current channel resource model work is still useful and should be treated as the migration base.

Recommended mapping:

- current `connector_instance` -> future `ConnectorAccount`
- current `remote_identity` -> split into `Audience` plus supporting identity metadata
- current `agent_profile` -> evolve into `PublishedAgent`
- current `channel_binding` -> evolve into `PublicationBinding`
- current `external_session` -> evolve into `IngressSession`
- current runtime conversation linkage -> evolve into `RuntimeSession`
- current `run` -> keep and expand

Key adjustments still needed:

1. move from backend-first selection to published-agent-first selection
2. make topic/thread a first-class audience
3. separate durable bindings from temporary overrides in both data model and UI
4. treat `/new` as runtime reset, not route mutation
5. move platform defaults toward connector-account-scoped defaults

## Risks

### 1. Reusing "chat" as the only peer identity

If the model stays at `chatId` only, topic and enterprise scenarios will remain second-class and later migration cost will rise.

### 2. Letting temporary overrides behave like durable bindings

This creates operator confusion and breaks publication predictability.

### 3. Treating runtime backend as the user-facing product object

This makes the platform feel like a thin transport shell around vendor runtimes instead of a real publication platform.

### 4. Keeping publication hidden inside connector settings

This prevents the UI from scaling to many agents, many audiences, and enterprise ownership.

## Recommended Next Step

The next implementation slice should focus on:

1. introducing `PublishedAgent` as the main UI selection object
2. adding explicit audience typing for `group` and `topic`
3. splitting durable binding and temporary override behavior
4. updating `/new` semantics and UI copy around runtime reset
5. building one minimal "Publication Binding" management surface in settings

## Summary

AionUi should evolve from "desktop agent with optional IM access" to:

**a multi-agent publication platform where IM is a native service surface**

The winning abstraction is not:

`which backend does this chat use?`

It is:

`which published agent is serving which audience through which connector, and what runtime session is currently active?`

That model supports:

- personal use
- group service
- topic-level routing
- enterprise publication
- OpenClaw-style orchestration

without locking the product to any single runtime vendor.
