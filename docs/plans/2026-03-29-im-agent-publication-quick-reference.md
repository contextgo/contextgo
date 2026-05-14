# IM Agent Publication Quick Reference

**Date:** 2026-03-29
**Status:** Working Reference
**Companion doc:** [2026-03-29-im-agent-publication-platform-design.md](./2026-03-29-im-agent-publication-platform-design.md)

This file is the short-term memory anchor for future implementation work.
When you forget "what was the intended model here?", read this file first.

## One-Sentence Product Definition

ContextGo is not "a mobile shell for one agent". It is:

**a platform that publishes many agents into IM surfaces and routes different audiences to different runtime sessions**

## What `Channel` Means In Product Terms

In the current product, `Channel` should be read as:

**the channel-side publication and operations surface**

It is not only:

- connector settings
- bot credentials
- a per-platform default agent selector

It should gradually cover:

- connector account management
- audience discovery
- publication binding management
- durable vs temporary routing operations
- later audit, permissions, and service health

Short version:

- `Channel` is the product surface operators use
- `ConnectorAccount + Audience + PublicationBinding` are the actual domain pieces underneath

## Current Code Snapshot

As of this worktree iteration, the following are already true in code:

- `agent.select` can accept `agentProfileId`
- `temporary_override` is a real routing scope
- `/new` clears temporary override for the current audience
- Telegram topic/thread now carries a stable peer key
- settings include a minimal `Publication Bindings` operator panel

## Core Mental Model

Always think in this order:

`ConnectorAccount -> Audience -> PublicationBinding -> PublishedAgent -> RuntimeSession -> Run`

Do not think in this order:

`platform -> chat -> backend enum -> conversation`

The second mental model is too small and causes wrong product decisions.

## The Two Session Rule

Never collapse these two into one concept.

### IM Ingress Session

Questions it answers:

- where did the message come from?
- which audience is this?
- what publication binding applies?

### Agent Runtime Session

Questions it answers:

- which published agent is active?
- which conversation is active?
- which root run is active?
- what execution state exists right now?

### Permanent invariant

`/new` resets the runtime session, not the ingress session and not the durable binding.

## Vocabulary

### ConnectorAccount

One real IM account or bot entry point.

Examples:

- one Telegram bot
- one Feishu app
- one enterprise WeChat account

### Audience

Who is being served.

Examples:

- one DM user
- one group
- one topic/thread
- one tenant-wide service surface

### PublishedAgent

One reusable capability that can be published.

This is the object users should select.
It is not the same thing as `gemini`, `codex`, or `openclaw-gateway`.

### PublicationBinding

The routing contract from audience scope to published agent.

### RuntimeSession

The currently active execution context for that audience.

### Run

One root or child execution instance.

## Three Product Layers

### Layer 1: Distribution

This answers:

- what can be published?
- where can it be published?
- who should be served?

Objects:

- `PublishedAgent`
- `Audience`
- `PublicationBinding`

### Layer 2: Runtime

This answers:

- what is currently active?
- what is the current conversation?
- what run graph exists?

Objects:

- `RuntimeSession`
- `Run`

### Layer 3: Connector Operations

This answers:

- is the account healthy?
- can it send and receive?
- is authorization valid?

Objects:

- `ConnectorAccount`

## Channel-Layer Rule

Do not design `Channel` as if it were only a transport plugin boundary.

The channel layer should eventually let operators answer:

- which connector accounts do we run?
- which audiences have we observed?
- which published agent serves each audience?
- is this route durable or temporary?
- what is the current service status for that audience?

If a proposal only adds:

- webhook setup
- bot login status
- default model

then it is still incomplete from the product point of view.

## Behavior Rules

## Durable vs Temporary

Two different operations must exist:

### Durable publication change

"Bind this audience to another published agent"

Effects:

- persists
- affects future runtime sessions
- survives `/new`

### Temporary override

"Use another published agent only for this current session slice"

Effects:

- temporary only
- cleared on `/new`
- must never silently become a durable route

### UI rule

These two operations must stay visibly separated in UI.
Do not hide them behind one generic binding form without durable vs temporary wording.

## Audience priority

Routing should conceptually resolve in this order:

1. temporary override
2. topic-specific binding
3. group-specific binding
4. direct-user binding
5. tenant-space binding
6. connector default

Exact implementation may evolve, but temporary overrides must always be clearly above durable defaults.

## Topic/thread rule

Topic/thread is not just metadata on a group message.
It must be a first-class audience dimension.

If topic identity is lost, all later product promises about topic routing become fake.

Current implementation shortcut:

- keep transport chat id for sending
- use peer key for routing
- Telegram topic peer key = `chatId:thread:threadId`

## PublishedAgent rule

User-facing selection should gradually move toward `PublishedAgent`.

Do not keep extending UI around:

- `ChannelAgentType`
- backend enums
- per-platform hardcoded agent labels

Those are implementation details only.

Current migration bridge:

- user-facing routing can already select by `agentProfileId`
- `ChannelAgentType` still exists only as a compatibility surface

## What To Preserve

When a user hits `/new`, preserve:

- connector/account identity
- audience identity
- durable publication binding
- authorization state

When a user hits `/new`, rotate:

- active conversation
- active root run
- runtime scratch context
- temporary overrides

## Minimal Settings Flow

If you need to remember how the current operator UI works, use this:

1. pick connector
2. use `Durable Publication` to set long-lived routing
3. use `Temporary Override` only for short-lived audience takeover
4. inspect existing bindings in two separate lists
5. if the same scope is saved again, update instead of creating a duplicate

## Scenario Cheatsheet

## Personal remote use

Model:

- audience = one DM user
- binding = private durable publication
- runtime = personal execution context

## Group service

Model:

- audience = one group
- binding = group publication
- runtime = one shared group-facing runtime context

## Topic service

Model:

- audience = one topic/thread
- binding = topic override or inherited group binding
- runtime = topic-specific execution context

Operator action:

- use durable publication
- scope = `remote_chat`
- scope key = thread peer key
- choose specialist agent profile

## Enterprise rollout

Model:

- audience = many org-managed surfaces
- published agent = tenant-owned capability
- bindings = admin-managed routing table

## Temporary incident override

Model:

- audience = one topic or group
- binding = temporary override
- `/new` = clears override and falls back to durable binding

## UI Memory Anchors

When designing UI, the top-level IA should trend toward:

- Connectors
- Published Agents
- Audiences
- Publications
- Runtime Sessions
- Activity / Audit

If a UI proposal only has:

- Channel Settings
- Default Model
- Default Agent

then it is still trapped in the old personal-bot mental model.

## Implementation Checklist

When touching this area, verify all of these:

- Is this change about ingress or runtime?
- Are we modifying durable routing or temporary override?
- Does `/new` preserve durable publication?
- Are topics/threads preserved as first-class identity?
- Are we exposing a published capability, not just a backend enum?
- Is the action owner-facing, audience-facing, or runtime-facing?

## Anti-Patterns

Avoid these.

### 1. "Switch agent" with no durability semantics

This is ambiguous and always becomes a bug later.

Always say whether the action is:

- durable publication change
- temporary session-only override

### 2. Reusing `chatId` as the whole routing identity

This blocks topic/thread support and causes migration pain.

### 3. Making OpenClaw the top-level product object

OpenClaw is a strong runtime backend, not the entire platform abstraction.

### 4. Hiding bindings inside connector settings only

This prevents the UI from scaling to many agents and many audiences.

## Current Implementation Priorities

The current foundation work should keep moving in this order:

1. temporary override semantics
2. disabled binding correctness
3. `/new` cleanup semantics
4. topic/thread audience identity
5. published-agent-first routing
6. publication management UI

## Future Coding Guidance

When naming new code, prefer names that match the target model:

- `PublishedAgent`
- `Audience`
- `PublicationBinding`
- `IngressSession`
- `RuntimeSession`

Avoid encoding old assumptions into new code names like:

- `DefaultAgentForPlatform`
- `ChatAgentType`
- `PluginSessionOwner`

Those names pull the codebase back toward the old model.

## Final Reminder

If you forget everything else, remember this:

**The platform is not deciding which backend one chat uses.**

It is deciding:

**which published capability serves which audience through which connector, and what runtime context is active for that audience right now.**
