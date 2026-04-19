# Runtime Support Scope

Runtime-boundary rules such as `cwd` vs `HOME`, `.contextgo/<runtime>/` vs `.contextgo/.<runtime>/`, and import vs passthrough are defined in [docs/conventions/runtime-boundary.md](./runtime-boundary.md).

This document focuses on which runtime surfaces ContextGo recognizes and supports.

ContextGo's current product-facing coding runtime set is intentionally narrowed to:

- `gemini`
- `claude`
- `codex`
- `opencode`

These four runtimes are the only ones that should appear in current product-visible runtime pickers, assistant preset choices, and new-user guidance flows.

## Legacy Compatibility

Some older runtime identities still exist in storage models, import pipelines, or old conversation rendering paths for compatibility with historical data:

- `acp` as a protocol / bridge layer
- `openclaw-gateway`
- `nanobot`
- older preset ids such as `codebuddy`

Rules for new work:

- Do not add new product UI that exposes these legacy runtime names.
- Do not add new presets or recommendation flows based on these legacy runtime names.
- If compatibility is required, keep it behind migration, import, or old-session handling paths.
- Prefer expressing current product support in terms of the four active runtimes above.

## Documentation Rule

When updating docs:

- describe the active runtime set as `gemini`, `claude`, `codex`, and `opencode`
- call out `acp` only as an implementation bridge when necessary
- label `openclaw-gateway`, `nanobot`, and `codebuddy` as legacy compatibility only

## Assistant Package Boundary

The supported runtimes above share the same product-level assistant package model.

- package-root `AGENTS.md` and package `docs/` are product-facing package surfaces shared across supported runtimes
- `.contextgo/` is the canonical workspace installation root for assistant package state
- runtime-home compatibility directories such as `.contextgo/.codex/` or `.contextgo/.claude/` are derived views only
- workspace-root runtime-native directories such as `.codex/skills` or `.claude/skills` are projections only
- only skills should be projected into runtime-native directories
- connector declarations remain package- and project-level metadata, not runtime-native state
- `hooks`, `commands`, and `schedules` remain ContextGo-native automation owned by `.contextgo/`
- Context Engine External Memory Strategy Adapter metadata stays runtime-neutral and belongs to package or policy declarations, not runtime-native directory state

Runtime-facing workspace docs are a separate concern:

- runtimes may consume workspace-root entry docs such as `AGENTS.md` or `CLAUDE.md`
- those files are workspace scaffold or projection outputs, not the package source of truth
- project `docs/` lives in the workspace root, not under `.contextgo/`

This distinction matters:

- package-root `AGENTS.md` is the packaged rules-entry document used for projection-aware product UI
- workspace-root `AGENTS.md` / `CLAUDE.md` describe repository instructions for runtime consumption
- these two surfaces may share content lineage, but they are not the same architectural object
- package-declared connectors describe required connector **types** and project-facing mount metadata, not authenticated runtime-local connections

## External Memory Strategy Adapter Boundary

ContextGo's External Memory Strategy Adapter SPI composes with the existing Context Engine model rather than introducing a new runtime-facing surface.

- agent packages may declare compatibility with adapter capability metadata, but `.codex/`, `.claude/`, `.gemini/`, and `.opencode/` must not become the source of truth for adapter state
- adapter participation is expressed against the current governance identities and dual-loop model: `session_steward`, `project_curator`, and `space_curator` remain the owning Context Engine roles
- adapter config schema refs and secret requirements stay abstract package or workspace-policy declarations, not runtime-specific filesystem conventions

## Verified Runtime-Native Surfaces

The matrix below captures the runtime-native project surfaces that are currently documented by the runtime vendors or official runtime docs as of **2026-04-17**.

### Codex

- Project instructions: `AGENTS.md` (with layered discovery from project root down to the current working directory).
- Project config: `.codex/config.toml`
- Project skills: `.codex/skills/`
- Project hooks: `.codex/hooks.json`
- Project plugin marketplace: `.agents/plugins/marketplace.json` plus local plugin folders under `plugins/`
- Related extension surface: custom agents / subagents via Codex agent configuration

Important:

- ContextGo's Codex projection target is `.codex/skills/`.
- Do not treat runtime-native skill directories as the source of truth.
- Codex docs currently describe skills, hooks, AGENTS.md, custom agents/subagents, MCP, and plugins as first-class customization layers; they do not document a separate project slash-command directory analogous to `.claude/commands` or `.gemini/commands`.

### Claude Code

- Project instructions: `CLAUDE.md` or `.claude/CLAUDE.md`
- Project settings: `.claude/settings.json`
- Project hooks: configured inside `.claude/settings.json`
- Project skills: `.claude/skills/`
- Legacy / compatibility command surface: `.claude/commands/`
- Project subagents: `.claude/agents/`
- Project scoped rules: `.claude/rules/`

Important:

- Claude Code now treats custom commands and skills as converging surfaces. Existing `.claude/commands/` files still work, but the newer skill surface is `.claude/skills/`.

### Gemini CLI

- Project instructions: `GEMINI.md` hierarchy rooted in the workspace
- Project settings: `.gemini/settings.json`
- Project hooks: configured inside `.gemini/settings.json`
- Project skills: `.gemini/skills/`
- Project commands: `.gemini/commands/`

Important:

- Gemini CLI distinguishes persistent background instructions (`GEMINI.md`) from on-demand skills (`.gemini/skills/`).
- Gemini hooks are settings-driven, not a standalone `hooks.json` file.

### OpenCode

- Project instructions: `AGENTS.md`
- Project config root: `.opencode/`
- Project skills: `.opencode/skills/`
- Project commands: `.opencode/commands/`
- Project plugins: `.opencode/plugins/`
- Project agents: `.opencode/agents/`
- Project modes: `.opencode/modes/`
- Project tools: `.opencode/tools/`

Important:

- OpenCode's native project config root is `.opencode/`.
- Hook-like extension behavior in OpenCode is plugin-driven; the official docs describe hooks as values returned by plugin modules rather than a standalone project `hooks.json` convention.

## Scripts And Support Files

`scripts/`, `references/`, `assets/`, and similar support files are **not** a cross-runtime top-level projection surface in ContextGo.

Rules for new work:

- do not invent a shared project-level `.contextgo/scripts` source of truth just because a skill bundle contains helper scripts
- treat support files as package-local or skill-local payload unless a runtime explicitly documents a dedicated top-level mechanism
- keep projecting only the runtime-native surfaces that are actually documented for that runtime, such as skills, commands, hooks, plugins, agents, rules, or instruction files

## Projection Rule For ContextGo

When ContextGo projects package state into runtime-native directories:

- `.contextgo/skills` remains the source of truth
- runtime-home compatibility directories such as `.contextgo/.codex/`, `.contextgo/.claude/`, `.contextgo/.opencode/`, and `.contextgo/.gemini/` are compatibility layers only
- workspace-root runtime-native skill directories are compatibility projections only
- do not infer a runtime's supported project surfaces from another runtime's conventions
- only project a surface when the target runtime actually documents and supports that surface
- do not invent runtime-native adapter-state conventions for Context Engine strategy adapters
- do not invent runtime-native connector-state conventions for Agent Package connector declarations

Examples:

- Codex canonical runtime store: `.contextgo/codex/`
- Codex runtime-home compatibility directory: `.contextgo/.codex/`
- Codex workspace skill projection target: `.codex/skills/`
- Claude canonical runtime store: `.contextgo/claude/`
- Claude runtime-home compatibility directory: `.contextgo/.claude/`
- Claude Code workspace skill projection target: `.claude/skills/`
- Gemini canonical runtime store: `.contextgo/gemini/`
- Gemini runtime-home compatibility directory: `.contextgo/.gemini/`
- Gemini CLI workspace skill projection target: `.gemini/skills/`
- OpenCode canonical runtime store: `.contextgo/opencode/`
- OpenCode runtime-home compatibility directory: `.contextgo/.opencode/`
- OpenCode workspace skill projection target: `.opencode/skills/`

See [docs/tech/agent-package-architecture.md](../tech/agent-package-architecture.md) for the package model and installation boundary.
