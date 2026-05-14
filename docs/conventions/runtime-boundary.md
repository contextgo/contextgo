# Runtime Boundary

This document defines the stable runtime boundary for ContextGo-managed coding runtimes.

Supported runtimes:

- `gemini`
- `claude`
- `codex`
- `opencode`

## Core Rule

ContextGo does **not** project or re-home runtime config, auth, cache, session, sqlite, or plugin state into the current project.

For a ContextGo-managed launch:

- process `cwd` is the workspace root
- runtime `HOME` / `XDG_*` remain runtime-native and user-owned
- runtime config and runtime-generated data stay in each runtime's own native locations
- project `.contextgo/` stores only ContextGo-owned workspace metadata
- runtime-facing workspace projections managed by ContextGo are limited to entry docs and skill directories

Rejected model:

- do not treat `<workspace>/.contextgo` as a runtime home
- do not create or rely on `.contextgo/.codex`, `.contextgo/.claude`, `.contextgo/.gemini`, or `.contextgo/.opencode`
- do not store project runtime policy in `.contextgo/runtime.json`

## Boundary Layers

### 1. Runtime-Native Global State

These paths remain owned by the runtime, not by ContextGo:

- `~/.codex/`
- `~/.claude/`
- `~/.gemini/`
- `~/.config/opencode/`
- `~/.local/share/opencode/`
- other runtime-native app-data paths on Windows or platform-specific equivalents

Rules:

- authentication stays here
- session sqlite / logs / caches stay here
- runtime plugin or package caches stay here
- external session discovery reads these native locations
- ContextGo must not copy these locations into project state just to launch or inspect a runtime

## 2. Workspace Root Surface

Path:

```text
<workspace>/
```

This is the project-facing surface discovered from `cwd`.

Examples:

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `docs/`
- runtime-native workspace projections such as `.codex/skills/`, `.claude/skills/`, `.gemini/skills/`, or `.opencode/skills/`

Rules:

- workspace-root instruction files are for runtime consumption from `cwd`
- workspace-root runtime-native directories are projections only
- workspace-root projections are not the source of truth for runtime auth or runtime state
- ContextGo should only manage runtime entry docs and runtime-native skill projections here
- other runtime-documented project files remain runtime-owned compatibility surfaces

## 3. ContextGo Workspace Metadata

Path:

```text
<workspace>/.contextgo/
```

This directory stores ContextGo-owned workspace metadata only.

Stable examples:

```text
.contextgo/
  skills/
  hooks/
  hooks.json
  commands.json
  schedules.json
  connectors/
```

Rules:

- `.contextgo/skills/` is the canonical workspace skill store
- `hooks`, `commands`, and `schedules` remain ContextGo-native automation
- connector mount metadata may live here
- runtime config, auth, session databases, logs, and caches must not live here

## Naming Rule

Use these terms consistently:

- `runtime-native global state`
  - the runtime's own home / XDG / app-data directories
- `runtime workspace projection`
  - runtime-facing files or directories in the workspace root, such as `CLAUDE.md` or `.codex/skills/`
- `ContextGo workspace metadata`
  - project-owned state under `.contextgo/`

Do not use the old terms:

- `canonical runtime store`
- `runtime-home compatibility directory`
- `.contextgo/<runtime>/` as a runtime config root
- `.contextgo/.<runtime>/` as a compatibility home

## Launch Rule

When ContextGo starts a managed runtime:

1. set `cwd` to the workspace root
2. keep runtime home and XDG resolution unchanged
3. prepare ContextGo-owned workspace entry docs and skill projections when needed
4. pass supported launch-time flags or session-level overrides only when ContextGo explicitly controls that turn

ContextGo must not launch a runtime by pretending the workspace is the runtime's home directory.

## External Session Rule

When ContextGo imports or discovers external sessions:

- scan the runtime's native global session/config locations
- do not look for project-copied runtime session databases under `.contextgo/`
- do not create project-owned mirrors of runtime history just to enable discovery

This keeps external-session import aligned with how the runtime actually runs on the user's machine.

## Model Ownership Rule

By default, model selection and auth follow the user's runtime-native CLI configuration.

That means:

- if the user configures a default model in their runtime, ContextGo inherits that runtime behavior
- ContextGo does not persist a project-level runtime model policy
- ContextGo may still apply explicit session-level overrides when the user chooses a model in ContextGo UI for that session

Session-level control is allowed.

Project-owned runtime home or project-owned runtime policy is not.

## Skills Rule

Skill handling remains project-aware without turning the project into a runtime home:

- `.contextgo/skills/` is the canonical workspace skill store
- runtime-native workspace skill directories are projections only
- personal global skill directories must not become the live source of truth for a managed workspace install

This rule applies to:

- `.codex/skills/`
- `.claude/skills/`
- `.gemini/skills/`
- `.opencode/skills/`

Those are runtime workspace projections, not runtime homes.
