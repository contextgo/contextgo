# Workspace Docs

This folder stores workspace documents for **Everything Claude Code Harness**.

These docs are meant for progressive disclosure. They explain the package surfaces and workspace conventions that an agent should load when a task actually touches that area. They are not meant to duplicate always-on instructions.

## Read This Folder As

- `docs/skills/README.md` - how packaged skills should be understood, extended, and routed
- `docs/commands/README.md` - how command surfaces work and when they are only compatibility shims
- `docs/hooks/README.md` - how hook-triggered automation works in ContextGo
- `docs/automation/README.md` - how schedules, loops, periodic jobs, and continuous workflows should be modeled
- `docs/specs/` - reviewed design specs and decision docs
- `docs/plans/` - executable implementation plans and verification checklists

## Authoring Rule

- Keep the root `AGENTS.md` concise and route detailed topic guidance into the relevant docs file.
- Treat these docs as reference context, not as a second always-on prompt surface.
- Keep product behavior grounded in `agent-package.json` and installed `.contextgo/` state.
