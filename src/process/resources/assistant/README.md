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
  connectors/
  workspace/
  skills/
  hooks/
  ...
```

`agent-package.json` is the machine-readable package manifest.

For package-owned skills, the manifest should carry the stable ownership set in
`payloads.skills.packagedSkillNames` and any generic-library hiding rule in
`payloads.skills.hidePackageOwnedSkillsFromLibrary`.

`AGENTS.md` is the packaged rules-entry document. It belongs to the rules layer, and ContextGo may project it into runtime-native entry files such as `CLAUDE.md` or `GEMINI.md`.

`docs/` carries deeper package guidance using progressive disclosure.

`workspace/` is the optional source root for package-owned workspace scaffold templates such as starter `AGENTS.md` and `docs/` files.

If the package needs runtime-facing workspace root docs such as `CLAUDE.md` or `GEMINI.md`, declare those derived
outputs in `entryDocument.runtimeEntryProjections`.

`skills/` carries task-specific executable workflow content.

`connectors/` is optional source material for package-declared connector requirements and project-facing mount guidance.

## Installation Boundary

Bundled packages install into workspace-owned `.contextgo/` state first.

Runtime-native directories such as `.agents/skills` or `.claude/skills` are projections only.

Do not model `connectors`, `hooks`, `commands`, or `schedules` as runtime-owned package state.

If a package declares `workspaceScaffold`, ContextGo may also seed project-root docs such as `AGENTS.md` and starter files under `docs/` when bootstrapping a new workspace.

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
- `figma-closed-loop`
  - package root: `src/process/resources/assistant/design/figma-closed-loop`
  - package-local payload: `skills/`
  - workspace automation: `.contextgo/commands.json`, `.contextgo/schedules.json`
- `marketing-creative-studio`
  - package root: `src/process/resources/assistant/creative/marketing-creative-studio`
  - skill source: `src/process/resources/skills/marketing-creative-studio-pack`
  - workspace automation: `.contextgo/commands.json`, `.contextgo/hooks/`, `.contextgo/hooks.json`, `.contextgo/schedules.json`
- `motion-studio`
  - package root: `src/process/resources/assistant/creative/motion-studio`
  - skill source: `src/process/resources/skills/motion-studio-pack`
- `visual-artifact-runner`
  - package root: `src/process/resources/assistant/creative/visual-artifact-runner`
  - package-local payload: `skills/`, `hooks/`
  - workspace scaffold: `workspace/` with starter `AGENTS.md` and inputs/recipes/exports docs
  - workspace automation: `.contextgo/commands.json`, `.contextgo/hooks/`, `.contextgo/hooks.json`, `.contextgo/schedules.json`
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
- `karpathy-coding-guard`
  - package root: `src/process/resources/assistant/engineering/karpathy-coding-guard`
  - package-local payload: `skills/`
  - workspace scaffold: `workspace/` with assumptions, changes, and verification docs

## Governance Rule

When adding or evolving a bundled package here:

- keep `AGENTS.md` short
- keep `agent-package.json` current when payload roots or install surfaces change
- put package-level explanation in `docs/`
- keep runtime-facing behavior in `AGENTS.md`
- make the skill source and workspace installation surfaces explicit in the package docs
- treat runtime-native directories as projections, not ownership roots
