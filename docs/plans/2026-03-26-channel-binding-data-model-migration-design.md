# Design: Channel Binding Data Model And Migration

**Date:** 2026-03-26
**Status:** Proposed
**Depends on:** [2026-03-26-channel-binding-resource-model-design.md](/Users/bytedance/project/ContextGo-channel-binding-design/docs/plans/2026-03-26-channel-binding-resource-model-design.md)

## Background

The resource-model design defines the target product architecture:

- `Connector`
- `RemoteIdentity`
- `AgentProfile`
- `Binding`
- `ExternalSession`
- `Run`

This document translates that model into:

- concrete storage shape
- legacy mapping
- runtime routing changes
- phased migration steps

The goal is to make implementation planning possible without losing the product semantics defined in
the higher-level design.

## Current State Summary

Today, the relevant channel storage and routing primitives are:

- `assistant_plugins`
  stores connector credentials and plugin status
- `assistant_users`
  stores authorized remote users keyed by `(platform_user_id, platform_type)`
- `assistant_sessions`
  stores active channel sessions linked to `conversation_id`
- `assistant_pairing_codes`
  stores pending pairing requests
- `conversations`
  stores chat history and a `source` plus `channel_chat_id`

The current runtime path:

1. receives a unified inbound message
2. derives context mostly from `platform`
3. looks up authorization by `platform_user_id + platform_type`
4. resolves default agent settings from `assistant.<platform>.agent`
5. reuses or creates a `conversation`
6. creates or reuses an in-memory session keyed by `userId + chatId`

This path is the main reason the system behaves as "one platform -> one default agent".

## Main Design Constraints

Any migration has to respect these current constraints.

### 1. Existing conversations must remain valid

Existing `conversations` records already carry real user history and backend-specific extra data.

The migration must not require rewriting all conversation history or changing conversation IDs.

### 2. Existing connector credentials must remain usable

The current `assistant_plugins` rows are the only persisted source of connector login state.

The migration must map these rows forward rather than force re-authentication.

### 3. Existing IM users must remain authorized

Existing `assistant_users` rows must be migrated into connector-scoped identities.

### 4. Runtime change must be incremental

The codebase should not switch from old routing to new routing in one non-compatible step.

There should be an overlap period where:

- legacy settings still load
- new binding resources exist
- runtime gradually prefers binding-based routing

## Proposed Storage Model

## Table: `connector_instances`

Purpose:

- persist ingress/egress connector instances
- replace the semantic role currently held by `assistant_plugins`

Suggested schema:

```sql
CREATE TABLE connector_instances (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  credentials TEXT NOT NULL,
  runtime_config TEXT NOT NULL,
  capabilities TEXT NOT NULL DEFAULT '{}',
  legacy_plugin_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_connector_instances_platform ON connector_instances(platform);
CREATE INDEX idx_connector_instances_enabled ON connector_instances(enabled);
```

Notes:

- `credentials` and `runtime_config` should be stored separately, unlike the current packed
  `config` column in `assistant_plugins`
- `legacy_plugin_id` provides a low-risk bridge during migration
- `status` can reuse current plugin lifecycle states

## Table: `remote_identities`

Purpose:

- persist approved ingress identities with connector scope
- replace the semantic role currently held by `assistant_users`

Suggested schema:

```sql
CREATE TABLE remote_identities (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  remote_user_id TEXT,
  remote_chat_id TEXT NOT NULL,
  remote_chat_type TEXT,
  display_name TEXT,
  authorized_at INTEGER NOT NULL,
  last_active INTEGER,
  metadata TEXT NOT NULL DEFAULT '{}',
  legacy_user_id TEXT,
  FOREIGN KEY (connector_id) REFERENCES connector_instances(id) ON DELETE CASCADE,
  UNIQUE (connector_id, remote_chat_id)
);

CREATE INDEX idx_remote_identities_connector_chat
  ON remote_identities(connector_id, remote_chat_id);
CREATE INDEX idx_remote_identities_connector_user
  ON remote_identities(connector_id, remote_user_id);
```

Why `remote_chat_id` is required:

- routing and session continuity are chat-scoped in current channel behavior
- one external group chat should be distinguishable from a private user chat

Why `remote_user_id` is nullable:

- some connectors may provide only a stable chat identity for certain contexts

## Table: `agent_profiles`

Purpose:

- persist reusable published agent capabilities

Suggested schema:

```sql
CREATE TABLE agent_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  backend TEXT NOT NULL,
  model_ref TEXT,
  workspace_ref TEXT,
  prompt_profile TEXT NOT NULL DEFAULT '{}',
  tool_policy TEXT NOT NULL DEFAULT '{}',
  memory_policy TEXT NOT NULL DEFAULT '{}',
  delegation_policy TEXT NOT NULL DEFAULT '{}',
  published_from_conversation_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (published_from_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX idx_agent_profiles_backend ON agent_profiles(backend);
CREATE INDEX idx_agent_profiles_archived ON agent_profiles(archived);
```

Notes:

- `model_ref` should store a serialized provider/model reference, not a platform-level setting key
- `delegation_policy` is important for orchestration-capable profiles such as OpenClaw

## Table: `channel_bindings`

Purpose:

- persist routing rules from ingress scope to agent profile

Suggested schema:

```sql
CREATE TABLE channel_bindings (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_key TEXT,
  agent_profile_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  temporary INTEGER NOT NULL DEFAULT 0,
  fallback_agent_profile_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (connector_id) REFERENCES connector_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (fallback_agent_profile_id) REFERENCES agent_profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_channel_bindings_connector_scope
  ON channel_bindings(connector_id, scope_type, scope_key, enabled, priority);
```

Recommended initial `scope_type` enum values:

- `connector_default`
- `remote_chat`
- `remote_user`
- `temporary_override`

Recommended uniqueness policy:

- at most one enabled `connector_default` per connector
- at most one enabled non-temporary binding for `(connector_id, scope_type, scope_key)`

## Table: `external_sessions`

Purpose:

- persist the active external chat relationship
- replace the semantic role of `assistant_sessions`

Suggested schema:

```sql
CREATE TABLE external_sessions (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  remote_identity_id TEXT NOT NULL,
  binding_id TEXT,
  agent_profile_id TEXT NOT NULL,
  active_conversation_id TEXT,
  state TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (connector_id) REFERENCES connector_instances(id) ON DELETE CASCADE,
  FOREIGN KEY (remote_identity_id) REFERENCES remote_identities(id) ON DELETE CASCADE,
  FOREIGN KEY (binding_id) REFERENCES channel_bindings(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (active_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  UNIQUE (connector_id, remote_identity_id)
);

CREATE INDEX idx_external_sessions_conversation ON external_sessions(active_conversation_id);
CREATE INDEX idx_external_sessions_last_activity ON external_sessions(last_activity DESC);
```

Important semantic difference from current sessions:

- the session is stable across `/new`
- only `active_conversation_id` changes on new-session reset

## Table: `runs`

Purpose:

- persist root and child execution runs
- support orchestration backends without leaking child execution into publication routing

Suggested schema:

```sql
CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  external_session_id TEXT,
  parent_run_id TEXT,
  root_run_id TEXT NOT NULL,
  agent_profile_id TEXT NOT NULL,
  backend TEXT NOT NULL,
  conversation_id TEXT,
  workspace_ref TEXT,
  status TEXT NOT NULL,
  input_message_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  FOREIGN KEY (external_session_id) REFERENCES external_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_run_id) REFERENCES runs(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_profile_id) REFERENCES agent_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX idx_runs_external_session ON runs(external_session_id, started_at DESC);
CREATE INDEX idx_runs_root_run ON runs(root_run_id);
CREATE INDEX idx_runs_parent_run ON runs(parent_run_id);
```

Notes:

- root runs have `id = root_run_id`
- child runs reference both `parent_run_id` and `root_run_id`
- child runs may omit `conversation_id` if they do not need dedicated history

## Optional Table: `pairing_requests_v2`

Purpose:

- preserve connector-scoped pairing requests

Suggested schema:

```sql
CREATE TABLE pairing_requests_v2 (
  code TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  remote_user_id TEXT,
  remote_chat_id TEXT NOT NULL,
  display_name TEXT,
  requested_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (connector_id) REFERENCES connector_instances(id) ON DELETE CASCADE
);

CREATE INDEX idx_pairing_requests_v2_connector_status
  ON pairing_requests_v2(connector_id, status, expires_at);
```

This table is not strictly required on day one, but the current pairing model is too
platform-scoped to support multi-instance connectors cleanly.

## Conversation Layer Changes

The existing `conversations` table should remain.

The migration should avoid adding connector-specific meaning directly into the primary conversation
identity.

Recommended changes:

- keep `source` for backward compatibility
- keep `channel_chat_id` for existing query paths
- add optional `external_session_id`
- add optional `root_run_id`

Suggested additive migration:

```sql
ALTER TABLE conversations ADD COLUMN external_session_id TEXT;
ALTER TABLE conversations ADD COLUMN root_run_id TEXT;
CREATE INDEX idx_conversations_external_session_id ON conversations(external_session_id);
CREATE INDEX idx_conversations_root_run_id ON conversations(root_run_id);
```

Rationale:

- current history and message lookup continue to work
- external routing and run graph gain stable references

## Legacy Mapping

## `assistant_plugins` -> `connector_instances`

Map each existing assistant plugin row to one connector instance.

Mapping rules:

- `id` -> `id`
- `type` -> `platform`
- `name` -> `name`
- `enabled` -> `enabled`
- `status` -> `status`
- unpack current `config.credentials` -> `credentials`
- unpack current `config.config` -> `runtime_config`
- `legacy_plugin_id` -> old `id`

Important follow-up:

The current credential packing should be normalized during migration.
This also provides a good opportunity to fix inconsistent sensitive-field handling.

## `assistant_users` -> `remote_identities`

Map current assistant users into connector-scoped remote identities.

Initial compatibility rule:

- infer `connector_id` from the currently active default connector for the same platform
- `platform_user_id` becomes both `remote_user_id` and `remote_chat_id` if no better chat identity exists

This is not perfect, but it is safe for the current single-default-per-platform reality.

## Platform default config -> `channel_bindings`

For each connector instance, create one `connector_default` binding from the current platform-level
agent selection.

Compatibility source keys:

- `assistant.telegram.agent`
- `assistant.lark.agent`
- `assistant.dingtalk.agent`
- `assistant.weixin.agent`

The selected backend/model settings should be translated into an `AgentProfile`, then bound through
one `connector_default` binding.

## `assistant_sessions` -> `external_sessions`

Map each current assistant session to an external session.

Initial compatibility rule:

- resolve the owning legacy user to a migrated `remote_identity`
- attach the mapped connector
- create `external_session.active_conversation_id = assistant_sessions.conversation_id`

## Runtime Routing Changes

## Current routing shape

Today, inbound message handling roughly does:

1. parse inbound message
2. derive `pluginId = ${platform}_default`
3. authorize by `(platform_user_id, platform_type)`
4. read `assistant.<platform>.agent`
5. find or create a `conversation`
6. store session keyed by `userId + chatId`

This path must be replaced gradually, not instantly.

## Target routing shape

Target inbound routing should do:

1. identify the actual `connectorId`
2. resolve or create `RemoteIdentity`
3. resolve binding by precedence
4. resolve the bound `AgentProfile`
5. resolve or create `ExternalSession`
6. reuse or create `activeConversationId`
7. create a root `Run`
8. hand execution to the backend runtime

## Compatibility router

During migration, introduce a compatibility routing service:

- `ChannelRouteResolver`

Responsibilities:

- accept `connectorId`, `platform`, `remoteUserId`, `chatId`
- first try new binding-based route lookup
- if no new binding exists, fall back to legacy platform defaults
- return a normalized route result:
  - `connectorId`
  - `remoteIdentityId`
  - `agentProfileId`
  - `bindingId`
  - `routeSource` = `binding` | `legacy_default`

This service should become the only routing dependency of `ActionExecutor`.

## `/new` Semantics In Storage

`/new` should update only the active conversation linkage, not publication resources.

Target behavior:

1. locate `ExternalSession`
2. terminate current root run and child runs
3. archive or finalize old run tree
4. create a new conversation for the same `agentProfileId`
5. update `external_sessions.active_conversation_id`
6. create a new root run

Resources preserved:

- `connector_instances`
- `remote_identities`
- durable `channel_bindings`
- `agent_profiles`

Resources replaced:

- current active `conversation`
- current root `run`
- current child runs

### Temporary override behavior

Temporary overrides should be modeled as either:

- a `channel_bindings` row with `temporary = 1`
- or session-local route metadata in `external_sessions.metadata`

Recommendation:

Use a real binding row for observability and consistency.

Then `/new` can safely:

- remove temporary bindings for that external session scope
- preserve durable bindings

## OpenClaw-Specific Runtime Changes

OpenClaw and similar orchestration runtimes need one more layer of persistence discipline.

### Root run ownership

The external channel should only ever bind to the root `AgentProfile`.

For example:

- connector binding -> `AgentProfile(openclaw-main)`

The root run then creates child runs as needed.

### Child-run persistence

V1 recommendation:

- root run must always persist
- child runs should persist in `runs`
- child conversations are optional unless the backend requires resume support

### New-session cleanup

When `/new` is triggered while an orchestration root is active:

- mark current root run as terminated
- mark all descendants as terminated or archived
- clear temporary execution scratch state
- create a fresh root conversation and root run

Without this, old child executions may keep emitting output into a logically reset chat.

## Phased Implementation

## Phase A: Repositories and migrations

Deliverables:

- migrations for new tables
- repository methods for `connector_instances`, `remote_identities`, `agent_profiles`,
  `channel_bindings`, `external_sessions`, `runs`
- migration script that seeds data from legacy tables

No runtime behavior change yet.

## Phase B: Compatibility route resolver

Deliverables:

- `ChannelRouteResolver`
- normalized route result type
- unit tests for legacy fallback and binding precedence

This is the pivot point between the old and new model.

## Phase C: Runtime switch-over

Deliverables:

- `ActionExecutor` reads connector-scoped routes
- pairing and authorization become connector-aware
- session creation uses `external_sessions`
- `/new` updates `active_conversation_id`

At the end of this phase, platform-level routing should no longer be the primary path.

## Phase D: Publishing and bindings UI

Deliverables:

- create `AgentProfile` from conversation
- connector default binding management
- remote chat override management

This is the first end-user-visible product expression of the new model.

## Phase E: Run graph and orchestration polish

Deliverables:

- root and child run persistence
- OpenClaw cleanup on `/new`
- diagnostics for active run tree

This phase should happen after the route model is stable.

## Initial API Surface Changes

The following APIs should be introduced or changed.

## New main-process services

- `ConnectorService`
- `RemoteIdentityService`
- `AgentProfileService`
- `ChannelBindingService`
- `ExternalSessionService`
- `RunService`
- `ChannelRouteResolver`

## Channel bridge direction

The current channel bridge is too plugin-centric.

It should evolve toward:

- connector management endpoints
- binding management endpoints
- published agent endpoints
- live external session endpoints

Legacy plugin endpoints can remain during migration, backed by `ConnectorService`.

## Testing Strategy

Minimum coverage for the migration:

- legacy data seeding into new tables
- route resolution precedence
- connector-scoped authorization identity lookup
- `/new` preserving durable bindings
- `/new` clearing temporary overrides
- OpenClaw root-run cleanup behavior

Recommended test layers:

- unit tests for repositories and route resolver
- unit tests for migration helpers
- integration tests for inbound message routing
- regression tests for old platform-default behavior under compatibility mode

## Risks

### 1. Over-migrating too early

If the runtime is switched before compatibility mapping is solid, existing users may lose access
paths or appear logged out.

### 2. Conversation ownership ambiguity

If both `ExternalSession` and `Run` try to own conversation lifecycle without a clear rule, the
system will become hard to reason about.

Recommendation:

- `ExternalSession` owns the active root conversation link
- `Run` owns execution state

### 3. Temporary override semantics drifting

If temporary overrides are not made explicit in storage, `/new` will remain ambiguous.

### 4. Child-run visibility scope creep

The implementation should not block on building a full run-graph UI.
Persist first, visualize later.

## Recommended Next Step

The next concrete implementation artifact should be:

`a migration-ready schema patch and repository interface proposal`

That should include:

- new TypeScript domain types
- migration version scaffold
- repository method signatures
- compatibility seeding helpers

This is the smallest next step that reduces ambiguity and prepares runtime refactoring safely.
