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

## Manifest-Driven Surface Rule

`agent-package.json` is the only machine-readable source of truth for an Agent Package.

That means:

- package identity comes from the manifest
- package payload availability comes from the manifest
- install surfaces come from the manifest
- runtime projection behavior comes from the manifest
- product UI surfaces must be derived from the manifest-backed package model, not from ad-hoc directory scanning

The renderer may render package surfaces such as `Rules`, `AGENTS.md`, `Docs`, `Skills`, `Hooks`, `Commands`, and `Schedules`, but it must not invent those surfaces by guessing from runtime-native directories or workspace file layout.

This rule exists to keep built-in assistants, imported assistants, and future cloud packages on one protocol.

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
- workspace scaffold templates
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

### Packaged rules-entry document

Inside the package root, `AGENTS.md` is the packaged rules-entry document.

It belongs to the assistant rules layer and serves as the concise routed entry point for workspaces or runtimes that read an `AGENTS.md`-style file.

This packaged rules-entry document is not the same thing as a runtime-specific workspace entry file.

### Runtime workspace entry document

When a package scaffolds a workspace, the runtime may expect different instruction entry filenames.

Examples:

- some runtimes consume `AGENTS.md`
- some runtimes consume `CLAUDE.md`

Those workspace entry files are projections or scaffold outputs for runtime consumption. They are not a separate package contract layer.

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

### Current project Skill Market install behavior

For the project-scoped Skill Market entry:

- installation lands in `<workspace>/.contextgo/skills/<skill-name>` first
- runtime-native directories may then be synchronized as projections for supported runtimes
- this means seeing `.claude/skills`, `.gemini/skills`, or `.codex/skills` after install does **not** imply those directories were the installation source of truth

Current implementation note:

- Skill Market catalog/config metadata is cached in memory for short TTL windows
- downloaded skill archives are **not** persisted in a reusable package cache across projects
- installing the same remote skill into another project currently triggers another archive download, then extracts into that project's `.contextgo/skills`

For the verified runtime-native surface matrix, see [docs/conventions/runtime-support.md](../conventions/runtime-support.md).

Project-root documentation is a separate category:

```text
AGENTS.md / CLAUDE.md / other runtime entry docs
docs/
```

These are workspace-root documents, not `.contextgo/` state. If they are package-provided, they come from `workspaceScaffold` templates or future explicit runtime-doc payloads.

## Agent Package v1

`Agent Package v1` is the filesystem protocol for packaged assistants.

The contract is intentionally small and progressive-disclosure friendly.

### Required package entry

Every package should have:

- `agent-package.json`
- `AGENTS.md`

`agent-package.json` is the machine-readable package manifest.

It should declare stable fields for:

- package identity
- logical payloads such as `rules`, `docs`, `workspaceScaffold`, `skills`, `hooks`, `commands`, and `schedules`
- the physical source roots for those payloads
- the installed workspace surfaces those payloads map to
- whether a payload is projected into runtime-native directories
- package-owned capability metadata when needed
  - for `skills`, this includes stable `packagedSkillNames`
  - `defaultEnabledSkillNames` remains the assistant default, not the package ownership boundary
  - `hidePackageOwnedSkillsFromLibrary` controls whether package-owned skills stay out of the generic skills picker

`AGENTS.md` is the top-level packaged rules-entry document. It should stay concise and should not become a giant manual.

It should answer:

- what kind of work the packaged rules are shaping
- where deeper package docs live
- what runtime entry files it may project into
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

- `AGENTS.md`: packaged rules-entry document used for workspace / runtime projection
- `docs/`: deeper package documentation
- `workspaceScaffold`: project-level starter docs written into the linked workspace when bootstrap is allowed
- `skills/*/SKILL.md`: task-specific executable instructions

When a package needs runtime-facing workspace instruction files, it should declare that routing in
`entryDocument.runtimeEntryProjections` rather than relying on bootstrap-time hardcoded filename maps.

`docs/` inside the package and `docs/` inside the workspace are different surfaces:

- package `docs/` is package-owned reference content used for product disclosure
- workspace `docs/` is project-root scaffolded documentation for the user's repository

Do not collapse those two concepts into one storage model.

### Optional executable capability payload

Packages may also include:

- workspace scaffold templates
- `skills/`
- `hooks/`
- command-source material
- schedule seed material

The exact source representation may vary while the product is still absorbing legacy bundles, but the installed workspace representation is canonical:

- workspace scaffold templates install into the workspace root, typically as runtime entry docs plus starter files under `docs/`
- commands install into `.contextgo/commands.json`
- hooks install into `.contextgo/hooks/` and `.contextgo/hooks.json`
- schedules install into `.contextgo/schedules.json`
- skills install into `.contextgo/skills/`

### Payload ownership matrix

The ownership model should stay explicit:

| Payload / surface       | Package source of truth                                                         | Workspace install surface                                | Runtime projection                                             | Product owner                               |
| ----------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------- |
| Rules entry document    | package-root `AGENTS.md` with `entryDocument.runtimeEntryProjections[*].target` | workspace root when scaffolded                           | yes, into runtime entry docs such as `CLAUDE.md` / `GEMINI.md` | Agent Package + runtime compatibility layer |
| Package deep docs       | package `docs/`                                                                 | not installed as `.contextgo` state                      | none                                                           | Agent Package                               |
| Workspace scaffold docs | `workspaceScaffold` templates                                                   | workspace root such as `AGENTS.md`, `CLAUDE.md`, `docs/` | runtime may read directly from workspace root                  | Agent Package + workspace bootstrap         |
| Skills                  | package `skills/` sources                                                       | `.contextgo/skills/`                                     | yes, skill-only projection into runtime-native skill dirs      | Agent Package + runtime compatibility layer |
| Hooks                   | package `hooks/` sources                                                        | `.contextgo/hooks/` + `.contextgo/hooks.json`            | no product-level runtime ownership change                      | ContextGo automation                        |
| Commands                | package command seeds / profiles                                                | `.contextgo/commands.json`                               | no                                                             | ContextGo automation                        |
| Schedules               | package schedule seeds / profiles                                               | `.contextgo/schedules.json`                              | no                                                             | ContextGo automation                        |

The important constraint is that `hooks`, `commands`, and `schedules` remain product automation features even if a specific runtime has partial compatibility features.

## Installation Rules

### 1. Install into `.contextgo/` first

Workspace bootstrap must first materialize package-owned state into `.contextgo/`.

Project-level scaffold files such as runtime entry docs and starter `docs/` files may also be written into the workspace root when the package declares `workspaceScaffold` and the target workspace does not already expose its own root guidance.

### 2. Runtime only projects skills

Supported runtimes may receive projected skills into their native directories, for example:

- `.codex/skills`
- `.claude/skills`
- `.gemini/skills`
- `.opencode/skills`

This projection exists for runtime compatibility only.

Runtime-facing root docs are also compatibility outputs when a package chooses to scaffold them:

- `AGENTS.md`
- `CLAUDE.md`

They live in the workspace root because runtimes may consume them there, not because `.contextgo/` stopped being the product-owned automation root.

When those runtime-facing root docs are generated by package bootstrap, the projection mapping should be declared in
`entryDocument.runtimeEntryProjections`.

### 3. Do not project hooks, commands, or schedules into runtime-native roots

`hooks`, `commands`, and `schedules` are ContextGo-native automation features.

They must remain owned by `.contextgo/` and the ContextGo product layer.

Current runtime support nuance:

- `skills` are broadly recognized across supported coding runtimes
- `hooks` may have runtime-specific compatibility in some runtimes, but the product contract still treats them as ContextGo automation, not as runtime-owned workspace semantics

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
- if the package scaffolds project docs, treat those files as workspace-root artifacts, not as `.contextgo` state

## UI Rendering Rule

The product UI should render agent surfaces from a normalized package model assembled by the backend.

Responsibilities are split as follows:

- manifest declares what payloads exist
- backend resolves payload files and projection metadata
- frontend renders the resolved surfaces

The frontend must not rely on:

- scanning runtime-native directories
- inferring package structure from incidental file presence
- treating `.codex/skills`, `.claude/skills`, or runtime root docs as the source of truth

If the product needs a new visible section, the protocol should be extended first and the renderer should follow that protocol.

### Legacy compatibility

Some existing built-in packages still carry absorbed legacy source material or preset-bound command seeds while the package model is being normalized.

That compatibility is allowed during migration, but it is not the long-term package model.

The target protocol is still Agent Package v1.

## Future Cloud Import Model

Future cloud-delivered assistants should reuse the same package model.

The distribution layer may change, but the package model should not.

That means the same package should be installable whether it comes from:

- a bundled first-party package inside the app
- a local import
- a future cloud registry or package catalog

Registry metadata, signing, and package transport can evolve separately. The installed workspace shape should remain the same.
