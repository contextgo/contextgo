# Runtime Support Scope

Runtime-boundary rules are defined in [docs/conventions/runtime-boundary.md](./runtime-boundary.md).

This document focuses on which runtime surfaces ContextGo recognizes and how they relate to the product-owned workspace model.

## Active Runtime Set

ContextGo's current product-facing coding runtime set is intentionally narrowed to:

- `gemini`
- `claude`
- `codex`
- `opencode`

These four runtimes are the only ones that should appear in current product-visible runtime pickers, assistant preset choices, and new-user guidance flows.

## Legacy Compatibility

Some older runtime identities still exist in storage models, import pipelines, or historical session rendering paths:

- `acp` as a protocol / bridge layer
- `openclaw-gateway`
- `nanobot`
- older preset ids such as `codebuddy`

Rules for new work:

- do not expose these legacy names in new product UI
- do not add new presets or recommendation flows based on them
- keep them only in migration, import, or historical-session compatibility paths

## Assistant Package Boundary

The supported runtimes above share the same product-level assistant package model.

- package-root `AGENTS.md` and package `docs/` are product-facing package surfaces
- `.contextgo/` is the canonical workspace installation root for ContextGo-owned package state
- runtime-native workspace directories such as `.codex/skills` or `.claude/skills` are projections only
- only skills should be projected into runtime-native workspace directories
- connector declarations remain package- and project-level metadata, not runtime-native state
- `hooks`, `commands`, and `schedules` remain ContextGo-native automation owned by `.contextgo/`

Important:

- runtime config and runtime-generated state are **not** part of assistant package installation
- ContextGo does not create project-owned runtime homes under `.contextgo/`
- external session discovery still reads each runtime's native global locations

## Runtime-Native Project Surfaces

ContextGo only manages two runtime-facing workspace projection categories:

- runtime entry documents consumed from the workspace root
- runtime-native skill directories

Other runtime-documented project files or folders may still exist because the runtime itself supports them, but ContextGo must treat those as runtime-owned compatibility surfaces rather than product-owned projections.

These are **workspace projections**, not ContextGo-owned runtime homes.

### Codex

- Workspace entry doc: `AGENTS.md`
- Skill projection target: `.codex/skills/`
- Compatibility-only runtime-owned workspace surfaces that may exist: `.codex/config.toml`, `.codex/hooks.json`

Important:

- ContextGo only projects `AGENTS.md` compatibility and `.codex/skills/`
- ContextGo does not treat `.codex/config.toml` or `.codex/auth.json` as its own managed storage
- runtime auth, sessions, logs, caches, and plugins remain runtime-native global state

### Claude Code

- Workspace entry doc: `CLAUDE.md` or `.claude/CLAUDE.md`
- Skill projection target: `.claude/skills/`
- Compatibility-only runtime-owned workspace surfaces that may exist: `.claude/settings.json`, `.claude/commands/`, `.claude/agents/`, `.claude/rules/`

Important:

- ContextGo only projects Claude entry-doc compatibility and `.claude/skills/`
- ContextGo does not treat `.claude/settings.json` as a project-owned runtime source of truth

### Gemini CLI

- Workspace entry doc: `GEMINI.md`
- Skill projection target: `.gemini/skills/`
- Compatibility-only runtime-owned workspace surfaces that may exist: `.gemini/settings.json`, `.gemini/commands/`

Important:

- Gemini distinguishes background instructions (`GEMINI.md`) from on-demand skills
- ContextGo only projects Gemini entry-doc compatibility and `.gemini/skills/`
- ContextGo does not own `.gemini/settings.json`

### OpenCode

- Workspace entry doc: `AGENTS.md`
- Skill projection target: `.opencode/skills/`
- Compatibility-only runtime-owned workspace surfaces that may exist: `.opencode/commands/`, `.opencode/plugins/`, `.opencode/agents/`, `.opencode/modes/`, `.opencode/tools/`

Important:

- OpenCode's runtime may use `.opencode/` as a workspace-facing config root
- ContextGo only projects `AGENTS.md` compatibility and `.opencode/skills/`
- runtime auth and state stay in native global XDG / app-data locations

## Projection Rule

When ContextGo projects package state into runtime-native workspace directories:

- `.contextgo/skills` remains the source of truth
- runtime-native workspace skill directories are projections only
- do not invent project-owned runtime config directories under `.contextgo/`
- do not infer one runtime's supported surfaces from another runtime's conventions
- only project runtime entry docs and skill surfaces that the target runtime actually documents and supports

Examples:

- Codex skill projection target: `.codex/skills/`
- Claude skill projection target: `.claude/skills/`
- Gemini skill projection target: `.gemini/skills/`
- OpenCode skill projection target: `.opencode/skills/`

## Scripts And Support Files

`scripts/`, `references/`, `assets/`, and similar support files are not a cross-runtime projection surface in ContextGo.

Rules for new work:

- do not invent a shared project-level `.contextgo/scripts` runtime convention
- keep support files package-local or skill-local unless a runtime explicitly documents a workspace surface for them
- keep projecting only actually documented runtime-native surfaces

See [docs/tech/agent-package-architecture.md](../tech/agent-package-architecture.md) for the package model and installation boundary.
