# Superpowers Harness Package Notes

This package contains ContextGo's first-party engineering harness inspired by the open-source Superpowers workflow model.

## Main Purpose

Superpowers provides the default engineering discipline package for:

- brainstorming and design
- implementation planning
- execution control
- TDD
- code review
- debugging
- pre-completion verification

## Package Surfaces

- `superpowers.md` and `superpowers.zh-CN.md`
  - runtime-facing assistant rules
- package root
  - `src/process/resources/assistant/engineering/superpowers`
- skill source
  - `src/process/resources/skills/engineering-pack`
- packaged engineering workflow skills
  - brainstorming
  - writing plans
  - executing plans
  - test-driven development
  - parallel-agent dispatch
  - code-review flows
  - systematic debugging
  - verification-before-completion
- ContextGo-native workspace automation
  - `.contextgo/commands.json`
  - `.contextgo/hooks/`
  - `.contextgo/hooks.json`
  - `.contextgo/schedules.json`

## Installation Surfaces

- `.contextgo/skills`
  - installs the engineering workflow skills declared by the preset package
- `.contextgo/commands.json`
  - seeded through the `contextgo-harness` workspace automation profile
- `.contextgo/hooks/` and `.contextgo/hooks.json`
  - seeded from `agent-package.json` under `payloads.hooks.defaultEnabledHookNames`
- `.contextgo/schedules.json`
  - seeded by ContextGo with the standard conversation schedule container for this package
- runtime-native directories
  - only receive projected skills where the runtime needs a native skill directory

## Stable Package Behaviors

This package should continue to:

- bias toward linked-workspace engineering delivery
- require explicit planning and verification
- keep execution and review stages visible
- use runtime-native directories only as skill projections, not as package ownership roots

## Authoring Rule

Keep runtime-facing assistant behavior in the localized root files, package governance notes in `docs/`, and executable engineering workflows in the packaged skills and workspace automation seeds.

## Migration Status

This package already behaves as a runtime-neutral engineering harness at the product boundary.

Its current source split is:

- package entry and package notes under `src/process/resources/assistant/engineering/superpowers`
- shared engineering workflow skill payload under `src/process/resources/skills/engineering-pack`
- workspace automation seeded by preset configuration and `workspaceAutomation.ts`

That split is acceptable during migration as long as `.contextgo/` remains the canonical install root and runtime-native directories stay projection-only.
