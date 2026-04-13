# Bundled Agent Packages

This directory contains bundled first-party and absorbed third-party **Agent Packages**.

## Default Rule

Treat each assistant package root here as a runtime-neutral package source, not as a runtime-owned preset folder.

New built-in assistants should follow the package model documented in:

- `docs/tech/agent-package-architecture.md`
- `AGENTS.md`

## Expected Package Shape

Each package should converge on this shape:

```text
<package-root>/
  agent-package.json
  AGENTS.md
  docs/
  skills/
  hooks/
  ...
```

`agent-package.json` is the machine-readable package manifest.

For package-owned skills, the manifest should carry the stable ownership set in
`payloads.skills.packagedSkillNames` and any generic-library hiding rule in
`payloads.skills.hidePackageOwnedSkillsFromLibrary`.

`AGENTS.md` is the concise human-facing package entry point.

`docs/` carries deeper package guidance using progressive disclosure.

`skills/` carries task-specific executable workflow content.

## Installation Boundary

Bundled packages install into workspace-owned `.contextgo/` state first.

Runtime-native directories such as `.codex/skills` or `.claude/skills` are projections only.

Do not model `hooks`, `commands`, or `schedules` as runtime-owned package state.

## Migration Note

Some existing bundled packages still include legacy prompt files or absorbed third-party payloads while the package model is being normalized.

That compatibility is acceptable during migration, but all new built-in assistants should be designed as Agent Package v1 from the start.

## Current Bundled Catalog

### Workspace and domain packages

- `morph-ppt`
  - package root: `src/process/resources/assistant/morph-ppt`
  - skill source: `src/process/resources/skills/morph-ppt`
- `startup-strategist`
  - package root: `src/process/resources/assistant/startup/startup-strategist`
  - skill source: `src/process/resources/skills/startup-strategist-pack`
- `design-director`
  - package root: `src/process/resources/assistant/design/design-director`
  - skill source: `src/process/resources/skills/design-director-pack`
- `pm-workbench`
  - package root: `src/process/resources/assistant/product/pm-workbench`
  - skill source: `src/process/resources/skills/pm-workbench-pack`
- `office-analyst`
  - package root: `src/process/resources/assistant/office/office-analyst`
  - skill source: `src/process/resources/skills/office-analyst-pack`
- `finance-analyst`
  - package root: `src/process/resources/assistant/finance/finance-analyst`
  - skill source: `src/process/resources/skills/finance-analyst-pack`

### Engineering harness packages

- `superpowers`
  - package root: `src/process/resources/assistant/engineering/superpowers`
  - skill source: `src/process/resources/skills/engineering-pack`
  - workspace automation: `.contextgo/commands.json`, `.contextgo/hooks/`, `.contextgo/hooks.json`, `.contextgo/schedules.json`
- `everything-in-claude-code`
  - package root: `src/process/resources/assistant/engineering/everything-in-claude-code`
  - package-local payload: `skills/`, `commands/`, `hooks/`, `scripts/`
  - workspace automation: `.contextgo/commands.json`, `.contextgo/schedules.json`

## Governance Rule

When adding or evolving a bundled package here:

- keep `AGENTS.md` short
- keep `agent-package.json` current when payload roots or install surfaces change
- put package-level explanation in `docs/`
- keep runtime-facing behavior in the localized rule files
- make the skill source and workspace installation surfaces explicit in the package docs
- treat runtime-native directories as projections, not ownership roots
