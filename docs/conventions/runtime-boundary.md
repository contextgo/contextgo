# Runtime Boundary

This document defines the stable runtime-boundary rule for ContextGo-managed coding runtimes.

Supported runtimes:

- `gemini`
- `claude`
- `codex`
- `opencode`

## Core Rule

For a ContextGo-managed runtime launch:

- process `cwd` is the workspace root
- process `HOME` is `<workspace>/.contextgo`
- `XDG_CONFIG_HOME` is `<workspace>/.contextgo`
- `XDG_DATA_HOME` is `<workspace>/.contextgo`

That means the repository root and the runtime home are intentionally different surfaces:

- the workspace root is the project and documentation surface
- `.contextgo/` is the project-owned runtime state boundary

ContextGo must not launch managed runtimes against the user's global home by default.

## Boundary Layers

### 1. Workspace Root Surface

Path:

```text
<workspace>/
```

This is the runtime-facing project surface that is discovered from the current working directory.

Examples:

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `docs/`
- workspace-root runtime-native projections such as `.codex/skills/`, `.claude/skills/`, `.gemini/skills/`, or `.opencode/skills/` when a runtime explicitly discovers them from `cwd`

This layer is for repository instructions, scaffolded docs, and `cwd`-scoped compatibility projections.

It is not the canonical store for runtime config or auth material.

### 2. Canonical ContextGo Runtime Store

Path:

```text
<workspace>/.contextgo/
```

This is the project-owned source of truth for runtime state.

Stable layout:

```text
.contextgo/
  runtime.json
  skills/
  claude/
  codex/
  opencode/
  gemini/
```

Rules:

- `.contextgo/runtime.json` stores the project runtime policy
- `.contextgo/skills/` is the canonical project skill store
- `.contextgo/<runtime>/` stores canonical imported or generated runtime state for that backend
- ContextGo-owned automation metadata also lives under `.contextgo/`

Do not treat workspace-root runtime-native directories as the source of truth when the same state already exists under `.contextgo/`.

### 3. Runtime-Home Compatibility Directory

Path pattern:

```text
<workspace>/.contextgo/.<runtime>/
```

This is a derived compatibility layer for runtimes that resolve home-scoped paths such as `~/.codex`, `~/.claude`, `~/.opencode`, or `~/.gemini`.

Stable names:

- `.contextgo/.claude/`
- `.contextgo/.codex/`
- `.contextgo/.opencode/`
- `.contextgo/.gemini/`

Rules:

- these directories are derived views, not the source of truth
- the canonical backend store remains `.contextgo/<runtime>/`
- do not use `.contextgo/<runtime>/` and `.contextgo/.<runtime>/` interchangeably
- if a runtime only needs a compatibility projection, project from `.contextgo/<runtime>/` into `.contextgo/.<runtime>/`

This naming is intentionally uniform across Claude, Codex, OpenCode, and Gemini.

## Naming Rule

Use the following terms consistently:

- `canonical runtime store`: `.contextgo/<runtime>/`
- `runtime-home compatibility directory`: `.contextgo/.<runtime>/`
- `workspace-root runtime projection`: runtime-facing files or directories in the workspace root such as `CLAUDE.md` or `.codex/skills/`

Do not call `.contextgo/<runtime>/` the compatibility layer.

Do not call `.contextgo/.<runtime>/` the source of truth.

Do not collapse workspace-root projections and runtime-home compatibility directories into one concept.

## Policy Resolution

Every project has one runtime policy in `.contextgo/runtime.json`.

Supported modes:

- `project_managed`
- `import_local_runtime`
- `auto`

Resolution rules:

- `project_managed`
  - ContextGo model-center selection and project-owned secrets are materialized into the project boundary
- `import_local_runtime`
  - ContextGo imports the minimum required runtime config and auth from the user's global runtime into `.contextgo/<runtime>/`
  - managed execution still reads only the project boundary after import
- `auto`
  - ContextGo first attempts a project-local import for the requested backend
  - if no importable local runtime is available, it resolves to project-managed state
  - the resolved execution state still lives inside the project boundary

`import_local_runtime` is an import model, not a live passthrough model.

## Backend Matrix

| Runtime    | Canonical store           | Runtime-home compatibility directory | Current note |
| ---------- | ------------------------- | ------------------------------------ | ------------ |
| `codex`    | `.contextgo/codex/`       | `.contextgo/.codex/`                 | Active for managed config and auth projection |
| `claude`   | `.contextgo/claude/`      | `.contextgo/.claude/`                | Active for managed settings projection |
| `opencode` | `.contextgo/opencode/`    | `.contextgo/.opencode/`              | Active for managed config and auth projection |
| `gemini`   | `.contextgo/gemini/`      | `.contextgo/.gemini/`                | Naming is reserved now; full runtime-home convergence is still partial in current implementation |

Gemini rule:

- keep the compatibility-layer name aligned with the other runtimes as `.contextgo/.gemini/`
- do not invent a different Gemini-only naming model
- document partial adoption honestly until Gemini's remaining global or in-process config paths are converged

## Skills Rule

Skill state follows the same boundary rule as runtime config:

- `.contextgo/skills/` is the canonical project skill store
- workspace-root skill directories such as `.codex/skills/`, `.claude/skills/`, `.gemini/skills/`, and `.opencode/skills/` are projections only
- a managed runtime must not load personal global skills from `~/.codex`, `~/.claude`, `~/.gemini`, `~/.opencode`, or other user-global skill directories
- bundled or imported skills should be materialized into the project boundary before execution

## Global State Boundary

The following surfaces are intentionally outside the project runtime boundary:

- `~/.contextgo/`
- `~/.codex/`
- `~/.claude/`
- `~/.config/opencode/`
- `~/.local/share/opencode/`
- `~/.gemini/`

Rules:

- `~/.contextgo/` is host-global ContextGo state such as sessions, sqlite databases, caches, or logs
- host-global ContextGo state is not the runtime home for a managed project launch
- third-party runtime global directories may be read during explicit import, detection, or diagnostics
- those global directories must not remain the live execution source for a managed project runtime

## Practical Launch Rule

When ContextGo starts a managed runtime:

1. set `cwd` to the workspace root
2. set `HOME`, `XDG_CONFIG_HOME`, and `XDG_DATA_HOME` to `<workspace>/.contextgo`
3. resolve runtime policy from `.contextgo/runtime.json`
4. materialize canonical backend state under `.contextgo/<runtime>/`
5. project any required home-scoped compatibility files into `.contextgo/.<runtime>/`
6. project any required workspace-root runtime files separately when the runtime discovers them from `cwd`

This keeps repository instructions, project-owned runtime state, and compatibility projections separate and predictable.
