# Obsidian ContextGo Cloud Sync Contract

## Purpose

This contract fixes the cross-repository boundary for Obsidian vault sync across:

- `contextgo/contextgo`
- `contextgo/connector`
- `apps/cloud`

The goal is to prevent the product repo, connector repo, and cloud service from redefining the same sync objects differently.

## Scope

This contract covers:

- single-user, same-account, multi-device sync
- one `Space` mapped to one Obsidian vault sync surface
- desktop replicas and mobile replicas
- full-vault sync semantics with file-class-aware policies

This contract does not cover:

- multi-user collaboration
- CRDT
- interactive merge UI
- formal compatibility with third-party sync products

## Shared Product Assumptions

- `obsidian` is a formal connector, not a loose plugin feature.
- `ContextGo Cloud` is the sync orchestration authority, not the only file authority.
- desktop and mobile both hold local full-vault replicas.
- remote WebUI is a control surface, not the primary local sync executor.
- the synced object is the `Space`-bound full vault, not only projected context artifacts.

## Shared Objects

### `vault_binding`

Represents the Obsidian sync surface bound to one `Space`.

Required fields:

- `vault_binding_id`
- `space_id`
- `owner_user_id`
- `connector`
- `default_landing_note`
- `sync_policy`
- `risk_level`
- `last_global_cursor`

### `replica`

Represents a device-local full vault copy.

Required fields:

- `replica_id`
- `vault_binding_id`
- `device_id`
- `platform`
- `plugin_version`
- `local_vault_fingerprint`
- `last_push_cursor`
- `last_pull_cursor`
- `health_status`

### `file_manifest`

Represents a replica-reported file index snapshot.

Required fields:

- `replica_id`
- `path`
- `file_class`
- `content_hash`
- `size`
- `mtime`
- `tombstone`
- `logical_revision`

### `change_batch`

Represents one pushed change unit.

Required fields:

- `batch_id`
- `vault_binding_id`
- `replica_id`
- `base_cursor`
- `assigned_cursor`
- `entries`
- `blob_refs`
- `created_at`

### `sync_checkpoint`

Represents the sync progress for one replica.

Required fields:

- `replica_id`
- `applied_cursor`
- `pending_from_cursor`
- `last_success_at`
- `last_error`
- `drift_flags`

## Shared Identifiers

The following identifiers must keep the same names and meanings across repos:

- `space_id`
- `vault_binding_id`
- `replica_id`
- `device_id`
- `global_cursor`
- `base_cursor`
- `assigned_cursor`

## File Classes

Every synced file must be classified into one of these shared classes:

- `content`
- `attachment`
- `obsidian-config`
- `workspace-state`

Interpretation:

- `content`: markdown, canvas, and content-adjacent source files
- `attachment`: binary or asset files
- `obsidian-config`: most `.obsidian` config, themes, snippets, plugin config
- `workspace-state`: high-drift layout or pane state such as `workspace.json`

## File Policy Semantics

- `content`: try automatic merge first, then Cloud latest-wins fallback
- `attachment`: latest-wins
- `obsidian-config`: latest-wins
- `workspace-state`: latest-wins and mark as high-drift

## Default Exclusions

The following should not be part of the formal sync set by default:

- caches
- logs
- lock files
- secrets / credentials
- obviously host-local runtime artifacts

## Repository Ownership

### `contextgo/connector`

Owns:

- Obsidian connector runtime
- Obsidian plugin project
- local vault watch / push / pull execution
- plugin install / detect
- deep links
- local risk signal reporting

### `apps/cloud`

Owns:

- `vault_binding`
- `replica`
- `file_manifest`
- `change_batch`
- `sync_checkpoint`
- sync push / pull API
- cursor allocation
- health and risk aggregation

### `contextgo/contextgo`

Owns:

- `Space -> vault_binding -> replica` product semantics
- cloud account / device / sync UI
- remote access vs vault sync UX separation
- risk / warning / health presentation

## Third-Party Sync Position

Third-party sync coexistence is not a formal compatibility target in this phase.

Required behavior:

- detect likely third-party sync presence when possible
- do not automatically block sync
- do not automatically force read-only mode
- expose risk through flags such as:
  - `third_party_sync_detected`
  - `drift_suspected`
  - `high_churn_paths`

## Contract Stability Rule

Before implementation expands:

- all three surfaces must use the same object names
- product docs in this repo define the canonical semantics
- connector/cloud repos must not silently fork object meanings
