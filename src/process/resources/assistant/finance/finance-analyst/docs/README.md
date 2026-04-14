# Finance Analyst Package Notes

This package contains ContextGo's built-in finance decision-support workflow.

## Main Purpose

Finance Analyst is intended for work that needs stronger analytical discipline than a generic research assistant, including:

- statement reading
- ratio benchmarking
- budget and prior-period variance analysis
- valuation work
- company comparison
- screening and diligence framing
- scenario planning
- thesis stress-testing
- investment-grade memo drafting

## Package Surfaces

- `AGENTS.md`
  - runtime-facing rules entry document
- `design.md` and `design.zh-CN.md`
  - deeper package design rationale
- package root
  - `src/process/resources/assistant/finance/finance-analyst`
- skill source
  - `src/process/resources/skills/finance-analyst-pack`
- bundled finance workflow skills
  - statement analysis
  - variance analysis
  - DCF valuation
  - comparable analysis
  - investment screening
  - scenario planning
  - SaaS metrics
  - investment memo drafting
- workspace command seeds matching those workflows

## Installation Surfaces

- `.contextgo/skills`
  - installs the finance workflow skills declared by the preset package
- `.contextgo/commands.json`
  - seeded through the `finance-analyst` workspace automation profile
- `.contextgo/schedules.json`
  - seeded by ContextGo with the standard conversation schedule container for this package
- runtime-native directories
  - only receive projected skills where the selected runtime needs native skill projection
- `.contextgo/hooks.json` and `.contextgo/hooks/`
  - this package does not currently contribute package-specific hook seeds

## Stable Package Behaviors

This package should keep emphasizing:

- period and unit discipline
- source consistency checks
- explicit confidence limits
- separation between confirmed figures and modeled assumptions

## Authoring Rule

Keep runtime-facing assistant rules in `AGENTS.md`, package design and governance notes in `docs/`, and executable finance workflows in packaged skills and workspace command seeds.

## Migration Status

The package root already owns:

- the runtime-facing rules entry document in `AGENTS.md`
- package routing and package-level docs
- the absorbed design rationale in `docs/`

The executable skill payload is currently sourced from `src/process/resources/skills/finance-analyst-pack`.

That split is acceptable during migration as long as `.contextgo/` remains the installation source of truth and the runtime only receives projected skills.
