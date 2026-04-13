# Agent Package Architecture

This document defines the default architecture for built-in assistants, imported assistant bundles, and future cloud-delivered assistant packages.

## Product Rule

In ContextGo, an assistant is not primarily a runtime preset.

It is an **Agent Package**: a runtime-neutral capability bundle that ContextGo can install into a workspace, expose in product UI, and optionally project into one or more supported runtimes.

This distinction matters because:

- runtime choice can change without changing the assistant package
- `skills`, `hooks`, `commands`, and `schedules` are product capabilities, not Claude-specific filesystem conventions
- built-in packages and future imported packages should share one installation model
- ContextGo must own the workspace automation boundary instead of inheriting third-party CLI layout as the product model

## Core Terms

### Assistant

A saved product definition selected by the user in the Agent surface.

An assistant may reference:

- one bundled or imported Agent Package
- a preferred runtime
- UI copy, recommendation hints, and bootstrap guidance

### Agent Package

A runtime-neutral package that carries the reusable instructions and capability payload for an assistant.

An Agent Package may contribute:

- `agent-package.json`
- `AGENTS.md`
- `docs/`
- `skills/`
- `hooks/`
- command seeds
- schedule seeds
- optional default workspace bootstrap strategy

### Runtime

A supported execution backend such as `gemini`, `claude`, `codex`, or `opencode`.

The runtime is responsible for execution, not for owning the assistant package model.

### Workspace Installation

The process of materializing an Agent Package into a working directory.

The canonical installation root is `.contextgo/`.

## Source Of Truth

### Bundled packages in source control

Bundled assistant packages live in:

`src/process/resources/assistant/`

Each package root should be treated as the package source of truth inside the product repository.

That root should include both:

- `agent-package.json` for machine-readable payload mapping
- `AGENTS.md` for concise human-facing routing

### Bundled packages in the installed app

When the desktop app is packaged, bundled assistant packages ship inside the application resources and are discovered through the bundled package registry plus each package's `agent-package.json`.

The installed application still treats the package as the source payload. The runtime-specific directories in a workspace are projections, not authoritative storage.

### Installed workspace state

After workspace bootstrap, the product-owned state must live under:

```text
.contextgo/
  skills/
  hooks/
  hooks.json
  commands.json
  schedules.json
```

Runtime-native directories remain derived views:

```text
.codex/skills   -> projection of .contextgo/skills
.claude/skills  -> projection of .contextgo/skills
.gemini/skills  -> projection of .contextgo/skills
```

ContextGo must not treat runtime-native directories as the source of truth for package installation.

## Agent Package v1

`Agent Package v1` is the filesystem protocol for packaged assistants.

The contract is intentionally small and progressive-disclosure friendly.

### Required package entry

Every package should have:

- `agent-package.json`
- `AGENTS.md`

`agent-package.json` is the machine-readable package contract.

It should declare stable fields for:

- package identity
- logical payloads such as `rules`, `docs`, `skills`, `hooks`, `commands`, and `schedules`
- the physical source roots for those payloads
- the installed workspace surfaces those payloads map to
- whether a payload is projected into runtime-native directories
- package-owned capability metadata when needed
  - for `skills`, this includes stable `packagedSkillNames`
  - `defaultEnabledSkillNames` remains the assistant default, not the package ownership boundary
  - `hidePackageOwnedSkillsFromLibrary` controls whether package-owned skills stay out of the generic skills picker

`AGENTS.md` is the top-level human-facing package contract. It should stay concise and should not become a giant manual.

It should answer:

- what this package is for
- what work it is good at
- what capabilities it installs
- where deeper package docs live
- any hard behavioral boundaries or escalation rules

### Manifest source mapping rule

`agent-package.json` exists so package facts do not live only in prose or only in preset code.

At minimum, the manifest should make stable:

- the logical payload name
- the physical source root for that payload
- the workspace install surface for that payload
- whether runtime-native projection is expected
- any package-owned capability set that runtime or UI logic must reason about without reading preset code

### Recommended deep documentation

Packages should add:

- `docs/`

Use `docs/` for deeper reference material, onboarding, examples, or domain-specific guidance that should not be loaded eagerly.

This is the default progressive disclosure boundary:

- `AGENTS.md`: short orientation and routing
- `docs/`: deeper package documentation
- `skills/*/SKILL.md`: task-specific executable instructions

### Optional executable capability payload

Packages may also include:

- `skills/`
- `hooks/`
- command-source material
- schedule seed material

The exact source representation may vary while the product is still absorbing legacy bundles, but the installed workspace representation is canonical:

- commands install into `.contextgo/commands.json`
- hooks install into `.contextgo/hooks/` and `.contextgo/hooks.json`
- schedules install into `.contextgo/schedules.json`
- skills install into `.contextgo/skills/`

## Installation Rules

### 1. Install into `.contextgo/` first

Workspace bootstrap must first materialize package-owned state into `.contextgo/`.

### 2. Runtime only projects skills

Supported runtimes may receive projected skills into their native directories, for example:

- `.codex/skills`
- `.claude/skills`
- `.gemini/skills`
- `.opencode/skills`

This projection exists for runtime compatibility only.

### 3. Do not project hooks, commands, or schedules into runtime-native roots

`hooks`, `commands`, and `schedules` are ContextGo-native automation features.

They must remain owned by `.contextgo/` and the ContextGo product layer.

### 4. Do not preserve third-party workspace semantics as the product boundary

When absorbing an external pack, do not keep its original runtime-specific workspace structure as the default product model.

Translate it into:

- runtime-neutral package semantics
- `.contextgo/` installation
- skill-only runtime projection

## Built-In Package Governance

All new built-in assistants should follow these rules:

- create or reuse one package root under `src/process/resources/assistant/`
- treat that root as an Agent Package, not as an ad-hoc prompt folder
- keep the package runtime-neutral
- keep `agent-package.json` current whenever payload roots or install surfaces change
- keep `AGENTS.md` small and route depth into `docs/` and `skills/`
- prefer ContextGo-native automation over runtime-specific bootstrap payload
- if package capabilities require workspace materialization, the installed form must land in `.contextgo/`

### Legacy compatibility

Some existing built-in packages still rely on legacy localized prompt files or preset-bound command seeds while the package model is being normalized.

That compatibility is allowed during migration, but it is not the long-term contract.

The target contract is still Agent Package v1.

## Future Cloud Import Model

Future cloud-delivered assistants should reuse the same package contract.

The distribution layer may change, but the package model should not.

That means the same package should be installable whether it comes from:

- a bundled first-party package inside the app
- a local import
- a future cloud registry or package catalog

Registry metadata, signing, and package transport can evolve separately. The installed workspace shape should remain the same.
