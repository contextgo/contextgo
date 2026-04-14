# PM Workbench Package Notes

This package contains ContextGo's built-in product-management workbench.

## Main Purpose

PM Workbench is intended for product work that needs stronger structure than ad-hoc prompting, especially when the user needs to:

- frame an initiative before committing roadmap space
- run discovery with explicit evidence gaps
- turn context into a usable PRD
- sequence a roadmap
- make prioritization choices with visible tradeoffs

## Package Surfaces

- `AGENTS.md`
  - runtime-facing rules entry document
- package root
  - `src/process/resources/assistant/product/pm-workbench`
- skill source
  - `src/process/resources/skills/pm-workbench-pack`
- bundled PM workflow skills
  - discovery
  - product strategy
  - PRD development
  - roadmap planning
  - prioritization
- workspace command seeds
  - `discover`
  - `strategy`
  - `write-prd`
  - `plan-roadmap`
  - `prioritize`

## Installation Surfaces

- `.contextgo/skills`
  - installs the PM workflow skills declared by the preset package
- `.contextgo/commands.json`
  - seeded through the `pm-workbench` workspace automation profile
- `.contextgo/schedules.json`
  - seeded by ContextGo with the standard conversation schedule container for this package
- runtime-native directories
  - only receive projected skills when required by the selected runtime
- `.contextgo/hooks.json` and `.contextgo/hooks/`
  - this package does not currently contribute package-specific hook seeds

## Stable Package Behaviors

This package should keep pushing work toward:

- evidence-led discovery
- explicit problem framing
- durable workspace artifacts
- practical prioritization instead of vague "high priority" labels

## Authoring Rule

Keep package entry and routing in `AGENTS.md`, deeper package notes here in `docs/`, and executable PM workflows in packaged skills and workspace command seeds.

## Migration Status

The package root already owns:

- the runtime-facing rules entry document in `AGENTS.md`
- package entry routing
- package notes under `docs/`

The executable skill payload is currently sourced from `src/process/resources/skills/pm-workbench-pack`.

That source split is acceptable during migration as long as workspace installation still lands in `.contextgo/` first and runtime-native directories stay projection-only.
