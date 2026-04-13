# Startup Strategist Package Notes

This package contains the built-in startup strategy assistant and its package-level guidance.

## Main Purpose

Startup Strategist is designed to help founders and early operators move from:

- vague startup ideas
- fuzzy target markets
- hand-wavy value propositions
- over-optimistic GTM plans

to sharper strategic choices grounded in evidence and explicit assumptions.

## Package Surfaces

- `startup-strategist.md` and `startup-strategist.zh-CN.md`
  - runtime-facing assistant rules and behavior
- `design.md` and `design.zh-CN.md`
  - the original package design rationale and scope notes
- package root
  - `src/process/resources/assistant/startup/startup-strategist`
- skill source
  - `src/process/resources/skills/startup-strategist-pack`
- bundled startup skills
  - founder problem framing
  - startup canvas
  - value proposition
  - ICP definition
  - strategic diagnosis
  - GTM planning
  - North Star metrics
  - founder brief

## Default Operating Stance

This package should keep working from:

`customer pain -> segment choice -> strategic choices -> business model -> go-to-market -> metrics`

It should also keep these package-level behaviors stable:

- downgrade confidence instead of decorating a weak thesis
- force a provisional primary segment when the target customer is still vague
- keep startup-stage uncertainty visible
- prefer durable strategy artifacts in a linked workspace

## Workspace Commands

This package currently seeds workspace command affordances such as:

- `stress-idea`
- `design-canvas`
- `scan-market`
- `define-icp`
- `shape-value-prop`
- `plan-gtm`
- `set-north-star`
- `write-founder-brief`

## Installation Surfaces

- `.contextgo/skills`
  - installs the packaged startup skills listed by `agent-package.json` under `payloads.skills.packagedSkillNames`
- `.contextgo/commands.json`
  - seeded through the `startup-strategist` workspace automation profile
- `.contextgo/schedules.json`
  - seeded by ContextGo with the standard conversation schedule container for this package
- runtime-native directories
  - only receive projected skills when the selected runtime needs a native skill directory
- `.contextgo/hooks.json` and `.contextgo/hooks/`
  - this package does not currently contribute package-specific hook seeds

## Authoring Rule

When evolving this package:

- keep `AGENTS.md` as the entry point
- keep runtime-facing assistant rules in the localized root files
- keep package rationale and deeper notes here in `docs/`
- keep executable startup workflows inside packaged skills and workspace command seeds

## Migration Status

The package root already owns:

- package entry routing
- runtime-facing localized rules
- package-level design documentation

The executable skill payload is still sourced from `src/process/resources/skills/startup-strategist-pack`.

That source split is acceptable during migration as long as the package continues to install through `.contextgo/` and the runtime only receives projected skills.
