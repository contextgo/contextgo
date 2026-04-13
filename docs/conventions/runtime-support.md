# Runtime Support Scope

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

- `AGENTS.md` and package `docs/` are product-facing package surfaces shared across supported runtimes
- `.contextgo/` is the canonical workspace installation root for assistant package state
- runtime-native directories such as `.codex/skills` or `.claude/skills` are projections only
- only skills should be projected into runtime-native directories
- `hooks`, `commands`, and `schedules` remain ContextGo-native automation owned by `.contextgo/`

See [docs/tech/agent-package-architecture.md](../tech/agent-package-architecture.md) for the package contract and installation model.
