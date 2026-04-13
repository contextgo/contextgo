# Design Director Package Notes

This package contains the built-in design-direction assistant and its package-level guidance.

## Main Purpose

Design Director exists to stop product design work from collapsing into vague adjectives or generic AI-looking UI.

The package is optimized for:

- visual archetype selection
- project-level design-system distillation
- screenshot critique
- Figma-reference absorption
- page art direction
- component-level visual specification
- implementation-ready handoff

## Package Surfaces

- `design-director.md` and `design-director.zh-CN.md`
  - runtime-facing assistant rules
- `design.md` and `design.zh-CN.md`
  - longer package design rationale
- package root
  - `src/process/resources/assistant/design/design-director`
- skill source
  - `src/process/resources/skills/design-director-pack`
- bundled design-direction skills
  - style archetype selection
  - system distillation
  - landing-page and product-surface art direction
  - screenshot critique
  - Figma-reference absorption
  - system adaptation
  - component visual spec
  - handoff brief

## Stable Package Behaviors

This package should continue to:

- classify the design task before choosing a workflow
- separate visual system, page-level art direction, and implementation handoff
- adapt to an existing design system before chasing a reference aesthetic
- absorb outside references as first-party system logic, not brand copying

## Workspace Commands

This package currently seeds commands such as:

- `pick-style`
- `draft-design-system`
- `art-direct-page`
- `critique-ui`
- `review-screenshot`
- `absorb-figma-reference`
- `adapt-system`
- `spec-component`
- `write-handoff`

## Installation Surfaces

- `.contextgo/skills`
  - installs the design workflow skills declared by the preset package
- `.contextgo/commands.json`
  - seeded through the `design-director` workspace automation profile
- `.contextgo/schedules.json`
  - seeded by ContextGo with the standard conversation schedule container for this package
- runtime-native directories
  - only receive projected skills when the runtime expects its own native skill directory
- `.contextgo/hooks.json` and `.contextgo/hooks/`
  - this package does not currently contribute package-specific hook seeds

## Authoring Rule

Keep runtime persona rules in the root localized files, package-level notes in `docs/`, and executable workflows in the packaged skills.

## Migration Status

The package root already owns:

- the runtime-facing assistant entry
- the short package contract in `AGENTS.md`
- the deeper package design material in `docs/`

The executable skill payload is currently sourced from `src/process/resources/skills/design-director-pack`.

That split is acceptable during migration as long as `.contextgo/` remains the installation source of truth and the runtime only receives projected skills.
