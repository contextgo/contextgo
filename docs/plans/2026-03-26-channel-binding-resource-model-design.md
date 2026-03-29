# Design: Channel Binding Resource Model

**Date:** 2026-03-26
**Status:** Proposed

## Background

ContextGo is evolving from a "single desktop chat app with optional IM integrations" toward a
system that:

- manages reusable context spaces
- lets users tune and publish agent capabilities
- exposes those capabilities through multiple external entry points
- supports orchestration-style runtimes such as OpenClaw

The current channel implementation is functional, but its product model is still:

`one platform -> one default connector -> one default agent choice`

That model works for early Telegram/Lark/DingTalk/WeChat access, but it does not match the desired
product direction:

- IM integrations should be reusable ingress resources
- agent capabilities should be reusable published assets
- one connector should be able to route to different agents by scope
- one tuned agent should be publishable to many channels
- orchestration runtimes should be able to create child runs without breaking the channel model

## Problem

The current implementation collapses several different concepts into one "channel settings" model.

Today, a single channel card implicitly mixes:

- connector authentication
- remote user authorization
- default agent routing
- default model selection
- session reset behavior

This creates several product and architecture problems.

### 1. Connector and routing are coupled

The current mental model is "configure a platform, then pick its agent".

That makes the platform appear to own the agent. In the intended product model, the platform should
only provide transport. It should not own capability routing.

### 2. Connector instances are not first-class in runtime logic

The codebase stores plugin records by `pluginId`, but the runtime path still frequently routes by
`platform`.

As a result, the system is structurally biased toward one default connector instance per platform.

### 3. Authorization is stored at the platform level, not the connector level

A remote identity is currently treated as unique by `(platform_user_id, platform_type)`.

That means:

- two connectors on the same platform cannot safely separate authorization
- identities from different connector instances may collide
- routing rules cannot reason about ingress source cleanly

### 4. There is no explicit binding object

The system has plugin records, user records, session records, and conversations, but no explicit
resource that means:

`this connector/scope is routed to this published agent`

Without this layer, the system falls back to platform-level defaults and temporary session behavior.

### 5. `/new` is not defined against a resource model

The current implementation creates a new conversation, but the product semantics are not explicit:

- should `/new` preserve the currently bound agent?
- should it fall back to a connector default?
- should it clear temporary overrides?
- what happens to orchestration child runs?

The lack of explicit resource boundaries makes these questions ambiguous.

## Goal

Define a resource model for channel access that separates:

- transport access
- remote identities
- agent capabilities
- routing rules
- external conversations
- internal execution

The design should support:

- multiple connector instances for the same platform
- one connector routing to different agents by scope
- one agent being published to multiple connectors
- publishing a tuned conversation into a reusable agent profile
- orchestration runtimes such as OpenClaw creating child runs safely
- predictable `/new session` behavior

## Non-Goals

This design does not propose implementing all of the following immediately:

- full UI redesign in one step
- complete migration away from legacy channel tables in one release
- a universal workflow engine
- automatic public webhook provisioning
- full child-run visualization in v1

## Design Principles

### 1. Connector is ingress/egress only

A connector only solves transport concerns:

- credentials
- webhook or polling configuration
- connectivity state
- send/receive capability
- platform-specific message adaptation

A connector does not own an agent.

### 2. Agent capability is a reusable asset

An agent profile is a reusable capability object that can be tuned, named, versioned, and
published.

It should survive independently of any specific connector.

### 3. Binding is the routing contract

Bindings are the explicit relationship between ingress scope and agent capability.

Bindings answer:

- which agent should answer on this connector?
- does this chat override the connector default?
- does this user override the chat default?

### 4. External session and internal execution are separate

The external chat that the user sees should not be the same concept as the internal execution graph.

This separation is required for runtimes like OpenClaw that may create child runs or invoke other
agents such as Codex.

### 5. `/new` resets context, not publication

Starting a new session should reset the active conversation context for a bound ingress route.

It should not silently destroy connector state or publication state.

## Proposed Resource Model

## Connector

Represents one ingress/egress integration instance.

Examples:

- `weixin-personal-main`
- `telegram-support-bot`
- `lark-feishu-sales`
- `ext-wecom-bot-prod`

Suggested fields:

- `id`
- `platform`
- `name`
- `credentials`
- `runtimeConfig`
- `enabled`
- `status`
- `capabilities`
- `createdAt`
- `updatedAt`

Responsibilities:

- authenticate to a platform
- receive inbound platform messages
- send outbound platform messages
- expose connection state

Non-responsibilities:

- choosing a final agent
- storing remote-user approval policy
- owning session memory

## RemoteIdentity

Represents one authorized remote party or chat scope associated with a connector.

Examples:

- one WeChat user on one WeChat connector
- one Telegram private chat on one Telegram bot
- one DingTalk group chat on one connector instance

Suggested fields:

- `id`
- `connectorId`
- `remoteUserId`
- `remoteChatId`
- `remoteChatType`
- `displayName`
- `authorizedAt`
- `lastActive`
- `metadata`

Key rule:

Remote identities must include `connectorId` in their uniqueness boundary.

This prevents collisions between different connector instances on the same platform.

## AgentProfile

Represents a reusable published capability.

An agent profile may be created directly or published from an existing conversation.

Suggested fields:

- `id`
- `name`
- `backend`
- `modelRef`
- `workspaceId`
- `promptProfile`
- `toolPolicy`
- `memoryPolicy`
- `delegationPolicy`
- `publishedFromConversationId`
- `version`
- `createdAt`
- `updatedAt`

Responsibilities:

- define who answers
- define model/runtime backend
- define long-lived capability settings
- define delegation rules for orchestration backends

## Binding

Represents routing from ingress scope to a published agent profile.

Suggested fields:

- `id`
- `connectorId`
- `scopeType`
- `scopeKey`
- `agentProfileId`
- `priority`
- `enabled`
- `fallbackAgentProfileId`
- `createdAt`
- `updatedAt`

Recommended initial `scopeType` values:

- `connector_default`
- `remote_user`
- `remote_chat`
- `temporary_override`

Examples:

- connector default: "all chats on `weixin-personal-main` go to OpenClaw"
- remote chat override: "this group chat goes to Codex"
- remote user override: "this private user goes to Support Agent"

## ExternalSession

Represents the long-lived external relationship between a remote chat and its current active
conversation.

Suggested fields:

- `id`
- `connectorId`
- `remoteIdentityId`
- `bindingId`
- `agentProfileId`
- `activeConversationId`
- `state`
- `createdAt`
- `lastActivity`

Responsibilities:

- track the current active conversation for one ingress route
- preserve continuity across messages
- survive `/new` while switching the active conversation

## Run

Represents one actual execution.

Runs support parent-child relationships so orchestration runtimes can delegate safely.

Suggested fields:

- `id`
- `externalSessionId`
- `parentRunId`
- `rootRunId`
- `agentProfileId`
- `backend`
- `conversationId`
- `workspaceId`
- `status`
- `inputMessageId`
- `startedAt`
- `endedAt`

Responsibilities:

- capture execution state
- model root and child runs
- separate external chat continuity from internal orchestration

## Product Semantics

### What "WeChat authorized" should mean

After this redesign, "WeChat authorized" should no longer be treated as one overloaded phrase.

It should be split into:

1. `Connector Auth`
   The local app has authenticated a WeChat connector and can receive/send messages.

2. `Remote Access Approval`
   A remote WeChat identity is allowed to enter the system through that connector.

3. `Binding`
   That connector or identity is routed to a specific agent profile.

These are independent product states.

### Publish Conversation as Agent

Publishing a tuned conversation should create an `AgentProfile`.

It should capture:

- backend/runtime
- preferred model
- workspace
- prompt or instruction state
- memory policy
- tool policy
- delegation policy if relevant

Publishing should not immediately alter any connector.

A separate binding action should decide where the new profile is exposed.

## Routing Model

Inbound routing should follow this order:

1. resolve `connectorId`
2. resolve or create `RemoteIdentity`
3. find binding by highest-priority scope
4. resolve target `AgentProfile`
5. resolve or create `ExternalSession`
6. resolve or create active `Conversation`
7. create root `Run`

Recommended binding precedence:

1. `temporary_override`
2. `remote_chat`
3. `remote_user`
4. `connector_default`
5. system fallback

This enables:

- one connector with a sensible default
- per-chat specialization
- temporary route changes without permanent publication edits

## `/new Session` Semantics

The resource model should define `/new` as:

`create a new active conversation for the current external session while preserving connector and binding state`

That means:

- keep `Connector`
- keep `RemoteIdentity`
- keep `Binding`
- keep `AgentProfile`
- replace `ExternalSession.activeConversationId`
- stop the old root run and its child runs
- create a new root conversation and root run

### `/new` should not do these by default

- disable or replace the connector
- delete remote authorization
- silently fall back to another connector
- silently fall back to platform-level defaults

### Override policy for `/new`

The design should distinguish:

- `temporary_override`
  only affects the current active conversation or current session slice
- durable binding override
  affects future conversations for the scope

Recommended behavior:

- `/new` clears `temporary_override`
- `/new` preserves durable bindings

This gives predictable behavior:

- new context
- same published route

## OpenClaw and Child Runs

OpenClaw should be modeled as a root agent profile that may create child runs.

Example:

1. WeChat message enters through `Connector`
2. Binding resolves to `AgentProfile(OpenClaw Main)`
3. A root `Run` is created
4. OpenClaw decides to delegate
5. It creates child runs for Codex, Gemini, or another agent profile
6. Child runs complete and report back to the root run
7. The root run returns the final result to the connector

This separation is critical.

The external publication layer should bind only the root agent profile.
Internal child-run orchestration should remain a runtime concern inside the run graph.

### `/new` in orchestration mode

When the active profile is orchestration-capable:

- terminate the current root run
- terminate or archive all child runs
- clear scratch state associated with the old root run
- create a new root conversation and root run

If this cleanup is not explicit, the system risks:

- old child runs still producing output
- messages returning to the wrong conversation
- accidental session-key reuse
- invisible background execution after a visible reset

## Current-System Gaps

The current codebase exposes the following mismatches against the target model.

### 1. Runtime still hardcodes a default plugin identity

The message action context currently derives:

`pluginId: ${platform}_default`

This prevents connector instances from being first-class at runtime.

### 2. Agent selection is platform-scoped

Current channel routing reads values like:

- `assistant.telegram.agent`
- `assistant.weixin.agent`

This makes platform the routing key instead of connector or scope.

### 3. Authorization is platform-scoped

Authorized remote users are keyed by platform identity without a connector boundary.

### 4. Sessions do not capture connector or binding identity

Current session isolation focuses on `userId + chatId`, which is useful for per-chat separation but
not sufficient for a publication model.

### 5. `/new` semantics are implementation-led, not model-led

The current implementation creates a new conversation, but its relationship to route persistence,
temporary overrides, and orchestration cleanup is not formally defined.

## Migration Strategy

Adopt an incremental migration, not a flag-day rewrite.

## Phase 1: Introduce first-class resources

Add new storage and repository support for:

- `connector_instances`
- `remote_identities`
- `agent_profiles`
- `channel_bindings`
- `external_sessions`
- `runs`

Do not remove the existing tables yet.

## Phase 2: Create legacy compatibility mapping

Map existing data to the new model:

- `assistant_plugins` -> `connector_instances`
- `assistant_users` -> `remote_identities`
- platform default agent config -> `connector_default` binding
- `assistant_sessions` -> transitional `external_sessions`

This phase should preserve user behavior while enabling new runtime code paths.

## Phase 3: Move runtime routing to bindings

Update inbound message handling to:

- resolve `connectorId`
- stop routing only by `platform`
- resolve agent via `channel_bindings`
- create or update `external_sessions`

This is the first phase where the product meaning materially improves.

## Phase 4: Separate UI into resource surfaces

Split current "Channels" settings into:

- `Connectors`
- `Published Agents`
- `Bindings`
- `Live Sessions`

This is necessary to align the UI with the resource model.

## UI Direction

### Connectors

Manage transport resources:

- login/token/webhook
- enabled status
- connection health
- platform diagnostics

### Published Agents

Manage reusable agent profiles:

- create from conversation
- edit metadata
- manage backend/model/workspace
- inspect publication targets

### Bindings

Manage routing:

- set connector default binding
- add user/chat overrides
- inspect priority and fallback

### Live Sessions

Inspect active external sessions:

- active conversation
- bound agent
- current run state
- temporary overrides

## Recommended First Implementation Slice

The first implementation slice should stay small.

It should support:

- multiple connector instances
- one default binding per connector
- chat-level binding override
- publishing a conversation into an agent profile
- inbound routing via `binding -> agentProfile`
- explicit `/new` semantics that preserve binding and reset context

This delivers the core product value without requiring full visualization of run graphs.

## Open Questions

These decisions should be made before implementation begins.

### 1. Should a chat-level agent switch create a durable binding or a temporary override by default?

Recommendation:

Default to a durable chat-level binding when the user explicitly says "switch this chat to X".
Reserve temporary overrides for advanced controls such as "use once".

### 2. Should `/new` preserve the currently active chat-level binding?

Recommendation:

Yes. `/new` should preserve durable routing and reset only the active conversation context.

### 3. Should agent profile publication snapshot memory or reference it?

Recommendation:

Snapshot configuration at publish time, but keep long-term memory policy configurable per profile.

### 4. Should child runs always have their own conversations?

Recommendation:

Not necessarily. Support child runs without full user-visible conversations in v1.
Only persist child conversations when a backend requires resume support or inspection value.

## Summary

The current channel system is close enough to the target problem space to migrate forward, but not
with more platform-default patches.

The correct product architecture is:

- `Connector` for transport
- `RemoteIdentity` for ingress identity
- `AgentProfile` for reusable capability
- `Binding` for publication and routing
- `ExternalSession` for external continuity
- `Run` for execution, including orchestration child runs

Under this model:

- IM access becomes a reusable resource
- tuned agents become publishable assets
- `/new` becomes a context reset, not a routing reset
- OpenClaw-style delegation fits naturally as a run-graph concern

This model matches the intended ContextGo positioning much better than the current
platform-default channel design.
