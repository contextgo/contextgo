# Design: IM-Native Agent Publication Platform

**Date:** 2026-03-29
**Status:** In Progress

## Current Implementation Snapshot

The following foundation slice is now implemented in the worktree built on top of PR 28:

- `temporary_override` is a real routing scope and wins over durable chat bindings
- `/new` clears the temporary override bound to the current IM audience, then falls back to durable publication
- `agent.select` can now route by `agentProfileId` instead of being limited to `ChannelAgentType`
- Telegram ingress now preserves `topic/thread` as a first-class peer dimension through a stable routing key
- settings now include a minimal `Publication Bindings` panel that separates `Durable Publication` from `Temporary Override`

This means the codebase has started to move from:

`platform -> chatId -> backend enum`

toward:

`connector -> audience peer -> publication binding -> agent profile -> runtime session`

## Background

AionUi already has several strong foundations:

- multiple runtime backends (`gemini`, ACP-routed agents, `codex`, `openclaw-gateway`)
- channel connectors for Telegram, Feishu/Lark, DingTalk, WeChat, and future platforms
- durable conversations and task execution
- assistant definitions with hooks, skills, prompt context, and workspace-aware runtime behavior

However, the current product model still leans toward:

`one user -> one assistant -> one personal remote session`

That model is good enough for personal remote control, but it is too narrow for the product
direction implied by OpenClaw-style routing and by real IM adoption patterns.

The stronger opportunity is:

- one platform hosts many agents
- those agents can be published to many IM entry points
- the published surface may serve the creator, a group, a topic thread, or an enterprise
- IM is not only a control surface, but also a distribution and service surface

## Why This Matters

The market gap is no longer simply "official coding agents do not have phone access".

As of **2026-03-29**, the official landscape has already moved:

- OpenAI Codex has terminal, IDE, web, and app surfaces
- Claude Code has terminal, IDE, desktop, browser, and iOS-linked web surfaces
- Gemini has strong mobile app presence and developer-facing CLI/IDE surfaces

That means AionUi should not define itself as:

- a mobile shell for one coding agent
- a connector-specific bot wrapper
- a UI that only forwards commands from phone to desktop

Instead, AionUi should define itself as:

**a multi-agent publication platform where IM is a native service surface**

## Core Product Principle

The system must assume that an agent may serve **third-party audiences**, not only its owner.

That means the platform should naturally support:

- a user talking to their own private agent
- a user publishing an agent into a group for others
- a user publishing different agents into different topics
- an organization publishing agents into enterprise connectors and group spaces

## Problem

Today several concerns are still too tightly coupled:

1. IM ingress identity and runtime execution identity are mixed together.
2. "Agent selection" is still too close to backend enums, not published capabilities.
3. Group and topic/thread usage are not first-class product concepts.
4. `/new` is still interpreted mainly as "start another conversation", not "reset runtime context while preserving publication".
5. UI still centers on connector configuration and per-platform defaults, instead of publication and audience routing.

As a result, the system can support:

- "I talk to an assistant from Telegram"

but not yet cleanly support:

- "I publish this agent to my team group"
- "this topic thread uses a different agent than the parent group"
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

This document does not fully solve:

- billing and seats
- app-store distribution
- full run-graph visualization in v1
- external public agent marketplace design
- replacing the existing local single-agent conversation product

## Two Session Boundaries

This is the most important design decision.

### 1. IM Ingress Session

The IM ingress session answers:

- which connector/account received the message
- which audience the message belongs to
- whether the audience is authorized
- which publication binding applies

It is about **entry, identity, and routing**.

It should stay stable even when the runtime conversation rotates.

### 2. Agent Runtime Session

The runtime session answers:

- which published agent currently handles this audience
- which conversation is active
- which root run is active
- which child runs exist
- what the current runtime state is

It is about **execution, context, and orchestration**.

It should be resettable without destroying publication.

### Required Rule

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
- define the ingress boundary for routing

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

This is the primary product-level object users should select and publish.
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

## Implementation Mapping In Current Code

The current code is not yet at the final model names above, but the direction is now concrete:

- `IConnectorInstance` is the runtime-side `ConnectorAccount`
- `IRemoteIdentity` plus unified `peer.key` together are the current bridge toward `Audience`
- `IChannelBinding` is the first executable form of `PublicationBinding`
- `IAgentProfile` is the current executable form of `PublishedAgent`
- `IExternalSession` plus `IChannelSession` together represent the current `RuntimeSession`
- `IChannelRun` is already the seed of `Run`

This is important because future refactors should rename and expand these objects, not replace the direction.

## Topic / Thread Modeling Rule

For Telegram and later connectors, `topic/thread` must not be stored as loose metadata only.

The current implementation rule is:

- transport chat id remains the platform send target
- routing uses a stable peer key
- for Telegram topic/thread, the peer key is `chatId:thread:threadId`
- the peer key is what session isolation, temporary override cleanup, and publication routing should use

That split is necessary because:

- replies still need the parent chat id as the transport target
- audience routing needs topic-level identity
- if transport identity and routing identity stay collapsed, topic publication is impossible to reason about

## Agent Selection Rule In This Iteration

`agent.select` now supports two modes:

### Compatibility mode

- input carries `agentType`
- resolver synthesizes or reuses the corresponding `IAgentProfile`
- a temporary override binding is created for the current audience

### Publication-first mode

- input carries `agentProfileId`
- resolver routes directly to that existing profile
- backend enum is no longer the only selectable identity

This is still not the final `PublishedAgent` UX, but it removes the hardest blocker:

the routing layer no longer requires agent selection to start from backend-first enums.

## Settings UI Interaction Scheme

The current minimal settings UI is intentionally operator-oriented.
It is not yet the final end-user publication console.

### Entry

- `Settings -> Channels`
- connector configuration remains above
- publication management sits below as a separate `Publication Bindings` section

### Panel structure

The current operator panel has three blocks:

1. connector selector
2. `Durable Publication` editor with audience picker and manual-key fallback
3. `Temporary Override` editor with audience picker and manual-key fallback

Below the editors, existing bindings are shown in two separate lists:

- durable publications
- temporary overrides

Each binding row now supports direct edit and delete actions, so operators can load an existing binding back into the correct editor instead of retyping the audience key.

### Durable Publication form

This form is for stable routing decisions.

Operator chooses:

- connector
- scope type: `connector_default | remote_user | remote_chat`
- scope key when needed
- agent profile
- priority

Save semantics:

- if the same connector + scope type + scope key already exists, update that binding
- otherwise create a new durable binding

### Temporary Override form

This form is for explicit short-lived audience takeover.

Operator chooses:

- connector
- exact audience key
- agent profile
- priority

Save semantics:

- creates or updates a `temporary_override`
- must always stay `temporary = true`
- should be considered disposable

### Why the two forms are separate

This separation prevents a dangerous ambiguity:

- "change the durable service entry for this group"
- versus
- "temporarily use another agent for this current audience slice"

If these are mixed into one form, operators will eventually create accidental long-lived overrides.

## Concrete Usage Scenarios

### Scenario A: Personal DM agent

User wants their Telegram DM to always open the same private agent.

Operator action:

- choose Telegram connector
- create durable publication
- scope = `remote_user`
- scope key = user id
- select private agent profile

Runtime result:

- every new DM session resolves to the same published capability
- `/new` resets runtime only

### Scenario B: Shared group service

A creator wants one group to be served by a team-facing OpenClaw agent.

Operator action:

- choose connector
- create durable publication
- scope = `remote_chat`
- scope key = group peer key
- select shared agent profile

Runtime result:

- the group has a durable service entry
- later personal DMs can still route elsewhere

### Scenario C: Topic-specific specialist

A parent group uses a general agent, but one topic thread needs a specialist agent.

Operator action:

- leave parent group durable binding in place
- create another durable publication
- scope = `remote_chat`
- scope key = `parentChatId:thread:threadId`
- select specialist profile

Runtime result:

- parent group keeps its default service
- one topic becomes a first-class audience with its own agent

### Scenario D: Temporary incident takeover

An operator wants a busy audience to temporarily switch to another agent during an incident window.

Operator action:

- use `Temporary Override`
- enter the exact audience key
- select fallback or incident agent profile

Runtime result:

- the current audience resolves to the temporary agent first
- `/new` clears the override and returns to durable routing

## Next Model Cuts

After this slice, the next larger steps should be:

1. rename product language from `agent profile` toward `published agent` in user-facing surfaces
2. promote `Audience` into a first-class persisted model instead of an implicit peer key + remote identity blend
3. add topic-aware audience pickers so operators do not need to manually paste scope keys
4. add a dedicated publication console in settings with published-agent centric browsing, search, and ownership views

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
- maintain stable auditability for which audience used which publication

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
- support inspection, cancellation, and audit

## Product Semantics

### AionUi should be "agent publication first"

Users should mostly think in terms of:

- which capability they are publishing
- who the audience is
- which route is active
- what the current runtime state is

Users should not need to think primarily in terms of:

- which backend enum is selected
- which CLI vendor is behind the current response
- whether the runtime is OpenClaw, Codex, Gemini, or something else

### Runtime backend remains an implementation detail

OpenClaw should be modeled as one strong runtime option because it supports orchestration, child runs,
delegation, and multi-step workflows. But it should remain inside `PublishedAgent.runtimeBackend`,
not above the publication model.

The same publication model should also support:

- Codex-backed published agents
- Gemini-backed published agents
- Claude/ACP-backed published agents
- future internal workflow runtimes

## Concrete Usage Scenarios

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
6. `/new` rotates only the runtime context.

### Product expectation

This is still supported, but it uses the same publication model as group and enterprise use.

## Scenario B: Group-Published Service

### Story

A user publishes a release assistant into a team group so multiple teammates can ask deployment,
summary, and troubleshooting questions.

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
6. Runtime isolation is per audience, not per sender.

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

Topics and threads must be first-class peers. They cannot be reduced to plain chat IDs.

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

## Session and Command Semantics

## First Message in an Unseen Audience

When a message arrives from a previously unseen audience:

1. resolve `ConnectorAccount`
2. resolve or create `Audience`
3. verify authorization and activation policy
4. resolve highest-priority `PublicationBinding`
5. load or create `IngressSession`
6. load or create `RuntimeSession`
7. load or create conversation and root run
8. dispatch to runtime

If no binding exists, the product should either:

- use one clearly visible connector default binding
- or enter a pending publication state and ask for admin action

It should not silently guess forever.

## `/new` Semantics

`/new` should:

1. terminate or interrupt the current root run
2. terminate or archive child runs if they exist
3. preserve the `IngressSession`
4. preserve the durable `PublicationBinding`
5. clear `temporary_override` if present
6. create a fresh conversation and root run
7. attach them to the same `RuntimeSession` or a rotated replacement runtime session

`/new` should not:

- revoke authorization
- detach the audience from the published agent
- delete the audience object
- change connector ownership

## Agent Switch Semantics

The UI should expose two separate actions.

### Change Publication

"Bind this audience to another published agent"

Effects:

- durable routing change
- affects future runtime sessions
- preserved across `/new`

### Use Temporarily

"Use another published agent for this session or topic once"

Effects:

- creates temporary override
- only affects current session slice
- cleared on `/new`

These two actions must not be merged into one ambiguous "switch agent" control.

## UI Design Direction

The UI should shift from "Channel Settings" to "Publication Operations".

Recommended top-level IA:

- Connectors
- Published Agents
- Audiences
- Publications
- Runtime Sessions
- Activity / Audit

## Connectors

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

## Published Agents

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

## Audiences

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

## Publications

Purpose:

- operate bindings as first-class routing contracts

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

## Runtime Sessions

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

1. name and description
2. select visibility
3. review runtime backend and model policy
4. review prompt, tool, memory, delegation policy
5. choose optional initial audiences
6. confirm publication

Result:

- creates `PublishedAgent`
- optionally opens "Create Publication Binding" drawer

## Flow B: Bind a Group to an Agent

Entry:

- from Audience detail
- from Published Agent detail
- from Publications page

Fields:

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

## Flow D: `/new` from Runtime Controls

Entry:

- IM command
- runtime controls panel
- Audience detail quick action

Confirmation copy:

- "Reset current runtime context"
- "Keep current publication binding"
- "Clear temporary override if one exists"

This is more precise than "start a new conversation".

## Evolution from Current Channel Resource Model

The existing PR 28 resource-model work is still the correct migration base.

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

### 1. Reusing `chatId` as the only peer identity

If the model stays at `chatId` only, topic and enterprise scenarios will remain second-class and later migration cost will rise.

### 2. Letting temporary overrides behave like durable bindings

This creates operator confusion and breaks publication predictability.

### 3. Treating runtime backend as the user-facing product object

This makes the platform feel like a thin transport shell around vendor runtimes instead of a real publication platform.

### 4. Keeping publication hidden inside connector settings

This prevents the UI from scaling to many agents, many audiences, and enterprise ownership.

## Recommended Next Step

The next implementation slices should focus on:

1. introducing `PublishedAgent` as the main UI selection object
2. adding explicit audience typing for `group` and `topic`
3. splitting durable binding and temporary override behavior everywhere
4. updating `/new` semantics and UI copy around runtime reset
5. building one minimal publication-binding management surface in settings

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
