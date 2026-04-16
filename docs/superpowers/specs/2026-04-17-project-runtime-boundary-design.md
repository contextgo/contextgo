# Project Runtime Boundary Design

## Summary

This design defines a project-scoped runtime boundary for ContextGo's supported coding runtimes:

- `gemini`
- `claude`
- `codex`
- `opencode`

The goal is to stop runtime execution from implicitly consuming global user state outside the active project while still allowing users to choose whether a project should:

- use ContextGo-managed model connectivity
- import an existing local runtime setup
- or auto-select between the two

The boundary applies to:

- skill loading
- runtime configuration files
- authentication material
- model selection defaults
- environment variables passed to runtime child processes

The project, not the runtime's global home directory, becomes the execution boundary.

## Problem

Current behavior is mixed:

- skills are increasingly projected into workspace-local runtime directories
- but runtime config, auth, and model defaults still come from global user locations such as `~/.claude`, `~/.codex`, or XDG home paths
- shell-derived environment variables such as `CODEX_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_*` are still inherited into runtime child processes

This creates three product problems:

1. a project can accidentally consume instructions or credentials that live outside the project
2. the runtime boundary is inconsistent across skills vs model/config state
3. ContextGo cannot cleanly express a project-owned model center integration because runtime behavior still depends on unmanaged global state

## Goals

- make the active project the default runtime boundary
- ensure runtime child processes do not directly consume global runtime config by default
- keep one unified runtime policy per project instead of splitting by agent or backend
- allow the user to choose whether a project uses:
  - ContextGo-managed model center connectivity
  - imported local runtime configuration
  - or automatic fallback between the two
- make runtime-native skill directories projection targets only
- make project-owned state the long-term source of truth for runtime execution

## Non-Goals

- do not redesign the full assistant package model
- do not redesign every runtime's full native config schema in this slice
- do not guarantee lossless import of every third-party runtime setting on day one
- do not change the set of supported coding runtimes
- do not introduce per-agent or per-runtime policy splits within a single project

## Product Rule

Each project gets exactly one runtime boundary policy.

That policy applies across all supported code runtimes used in that project.

The user does not configure separate runtime-home ownership for Claude vs Codex vs OpenCode inside the same project. They configure one project-level policy, and ContextGo materializes the runtime-specific projections required by each backend.

## Chosen Model

### 1. Project-level runtime policy

Each project stores a single runtime policy with three allowed modes:

- `project_managed`
- `import_local_runtime`
- `auto`

Meaning:

- `project_managed`
  - ContextGo model center is the source of truth
  - runtime config and auth material are materialized into the project boundary
- `import_local_runtime`
  - the user explicitly chooses to use an existing locally configured runtime
  - ContextGo imports the needed config/auth material into the project boundary
  - runtime execution still reads from the project boundary, not from the global home
- `auto`
  - ContextGo first attempts local-runtime import
  - if no usable local runtime config exists, ContextGo falls back to the model center path
  - the resolved state is still materialized into the project boundary

### 2. Project runtime home

Each project receives a project-owned runtime root:

```text
.contextgo/runtime/
```

Recommended initial layout:

```text
.contextgo/runtime/
  runtime.json
  skills/
  claude/
  codex/
  opencode/
  gemini/
```

This is the execution boundary for runtime-owned state.

Runtime-native directories in the workspace root remain compatibility projections:

```text
.claude/
.codex/
.opencode/
.gemini/
```

Those root-level runtime directories are derived views when required by a runtime. They are not the primary source of truth.

### 3. Project-owned env construction

When launching a runtime child process, ContextGo constructs a project-scoped environment instead of passing through the user's global runtime home.

At minimum, the runtime launcher must control:

- `HOME`
- `XDG_CONFIG_HOME`
- `XDG_DATA_HOME`

It must also stop blindly inheriting runtime auth variables from the shell environment, especially:

- `CODEX_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_AUTH_TOKEN`
- `ANTHROPIC_BASE_URL`

If a project chooses a mode that needs those values, ContextGo re-injects project-selected values explicitly after policy resolution.

## Storage Model

### `runtime.json`

`runtime.json` is the project-level runtime policy document.

Initial shape:

```json
{
  "version": 1,
  "mode": "project_managed",
  "resolvedSource": "model_center",
  "providerProtocol": "openai",
  "baseUrl": "https://example.internal/v1",
  "apiKeyRef": "project-secret:runtime-primary",
  "defaultModel": "gpt-5.4",
  "importedFrom": null,
  "lastImportedAt": null
}
```

Notes:

- `mode` is the user-selected policy
- `resolvedSource` captures the effective runtime source after `auto` resolution
- `providerProtocol` expresses the message protocol contract used by the selected model center entry
- `apiKeyRef` points to project-owned secret material or a project-scoped secure-store reference
- `defaultModel` is the project's default model identity across supported coding runtimes

### Secret handling

Sensitive values should not require plain-text commits into the user's repository.

Allowed implementations:

- project-scoped secret files under ignored runtime state
- project-scoped secure-store references held by ContextGo

The main rule is architectural, not storage-format-specific:

- the secret must be project-scoped at execution time
- the runtime must not need to reach outside the project boundary to obtain it

## Skill Boundary Rule

The project runtime boundary must apply to skills as strictly as it applies to model configuration.

Required behavior:

- runtime discovery only sees project-local skill projections
- global user skill directories must not remain live runtime sources
- bundled/package skills may be installed into the project, but they should be materialized into project-owned state rather than remaining project-external symlink sources
- if a user wants to use a global or packaged skill in a project, ContextGo should import or materialize it into the project boundary

This is stricter than the current implementation, where project runtime directories may still point at project-external sources through symlinks.

## Import Model

`import_local_runtime` is an import flow, not a passthrough mode.

That distinction is critical.

If the user chooses to use a locally configured runtime, ContextGo should:

1. inspect the runtime's global config/auth locations
2. extract the minimal required runtime state
3. normalize or translate it where needed
4. write it into `.contextgo/runtime/<runtime>/...`
5. launch the runtime using the project-scoped runtime home

After import, runtime execution should no longer depend on the original global files.

### Initial import targets

- Claude
  - import from `~/.claude/settings.json`
- Codex
  - import from `~/.codex/config.toml`
  - import from adjacent auth material such as `auth.json`
- OpenCode
  - import from `~/.config/opencode/opencode.json`
  - import from the runtime's auth path under XDG data
- Gemini
  - import from the runtime's current managed settings location

Day-one import can be partial.

It is acceptable to import only:

- model identity
- auth/base URL material
- required execution flags

It is not necessary to fully preserve every optional upstream runtime preference in the first slice.

## ContextGo Model Center Integration

`project_managed` mode should use ContextGo's model center as the runtime source.

The product already has a unified model-center abstraction:

- one API base
- one key or auth material set
- one protocol contract such as OpenAI-compatible or Anthropic-compatible messaging

Project runtime policy should bind to that abstraction directly.

Required behavior:

- the project stores which model center provider entry it wants
- ContextGo materializes runtime-specific config projections from that project setting
- the runtime child process only receives project-scoped config/env derived from that selection

This lets ContextGo support different runtime CLIs without turning their global config directories into the product boundary.

## Runtime-Specific Projection Rules

The project runtime boundary stays unified, but each runtime still needs compatibility projection.

### Claude

- runtime settings path resolution must become project-aware
- model selection should come from project runtime state, not directly from `~/.claude/settings.json`
- any runtime-facing entry docs or config files written for Claude should be generated from the project runtime boundary

### Codex

- config and auth path resolution must become project-aware
- approval policy and default model should be read from project runtime state
- `~/.codex/config.toml` must stop being the active runtime read-path once the project boundary is enabled

### OpenCode

- config and auth locations must resolve inside the project runtime boundary
- ContextGo should write the needed compatibility files under `.contextgo/runtime/opencode/`

### Gemini

- existing managed settings lookup should be redirected to project runtime ownership when the project boundary is enabled
- model center mapping should drive the runtime's effective model source

## Launch Flow

Introduce a dedicated runtime-boundary resolver service.

Suggested service:

- `ProjectRuntimeService`

Responsibilities:

1. load the project's runtime policy
2. resolve the effective source (`model_center` vs imported local runtime)
3. materialize runtime-specific config into project-owned state
4. prepare project-scoped environment variables
5. return launch-ready runtime metadata to the caller

Suggested launch sequence:

1. conversation/runtime creation identifies the target workspace
2. runtime bootstrap calls `ProjectRuntimeService.resolve(workspace)`
3. the service ensures `.contextgo/runtime/` is up to date
4. the service returns:
   - effective mode
   - runtime home paths
   - filtered environment variables
   - runtime-specific config paths
5. child-process launch uses those values and does not fall back to shell-global runtime config

## UI and User Control

The project should expose one runtime policy control.

It should not ask the user to configure this separately for Claude vs Codex vs OpenCode.

Recommended project-level options:

- `Use ContextGo Model Center`
- `Import Local Runtime Setup`
- `Auto`

Supporting actions:

- `Import now`
- `Re-import local setup`
- `Reset to project-managed`
- `View effective runtime config`

Settings and diagnostics pages should show project runtime config locations instead of only showing global home-directory config paths.

## Migration Strategy

### Phase 1: enforce the project boundary

This phase should focus on execution correctness, not complete UX.

Scope:

- add project runtime policy storage
- add project runtime home creation
- filter inherited runtime env vars
- redirect runtime config resolution to project-aware paths
- make skills project-only by materializing them into project-owned state

### Phase 2: complete product integration

Scope:

- connect project runtime policy to model center UI and storage
- add import/re-import UX
- improve diagnostics and config viewers
- fill runtime-specific import gaps

This sequencing keeps the first slice focused on boundary correctness and reduces rollout risk.

## Implementation Hotspots

Expected primary code touchpoints:

- `src/process/utils/initAgent.ts`
  - workspace skill materialization and runtime projection
- `src/process/utils/shellEnv.ts`
  - shell inheritance filtering and project-scoped env building
- `src/process/agent/acp/acpConnectors.ts`
  - inject project runtime home into spawned ACP runtimes
- `src/process/agent/acp/index.ts`
  - stop direct global Claude model lookup
- `src/process/agent/acp/utils.ts`
  - Claude settings path resolution becomes project-aware
- `src/process/agent/codex/connection/CodexConnection.ts`
  - Codex config/auth path resolution becomes project-aware
- `src/process/bridge/acpConversationBridge.ts`
  - report project runtime config locations instead of only global config locations
- new project runtime resolver/service under `src/process/services/`

## Acceptance Criteria

- a project can run supported coding runtimes without directly reading global runtime config by default
- a project can choose between model-center-managed and imported-local-runtime policy
- imported local runtime setup is copied into the project boundary instead of remaining a live passthrough to the global home
- runtime child processes only see project-selected auth/config env values
- runtime skill discovery only sees project-owned skill state
- settings and diagnostics can explain the effective project runtime source

## Risks

### Runtime compatibility gaps

Some runtimes may assume a user-global home layout. Redirecting them to a project-scoped runtime home may reveal compatibility edge cases.

### Partial import fidelity

Initial import may not preserve every upstream setting. The first release should prioritize correct model/auth execution over full preference fidelity.

### Test baseline expansion

Many existing tests assume global config paths. Project-aware path resolution will require broad fixture updates.

### Secret storage decisions

The exact project-scoped secret storage mechanism must align with ContextGo's secure storage model, but that should not block adoption of the boundary itself.

## Why This Design

This design is intentionally strict.

If ContextGo allows runtime execution to keep directly consuming global config, then project-owned skills alone do not establish a real project boundary. The runtime remains partially outside the project.

By making local-runtime use an import flow instead of a passthrough, ContextGo preserves user choice without giving up the clean project boundary required for:

- predictable execution
- project-scoped model center integration
- future remote/runtime portability
- and cleaner product semantics
