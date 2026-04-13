# Finance Analyst Package

This package backs ContextGo's built-in **Finance Analyst** assistant.

## Use This Package For

- financial statement analysis
- variance review and scenario planning
- valuation and comparable analysis
- investment screening and thesis stress-testing
- executive finance reporting in a linked workspace

## Package Surfaces

- runtime-facing assistant rules: `finance-analyst.md`, `finance-analyst.zh-CN.md`
- package notes: `docs/README.md`
- deeper package design rationale: `docs/design.md`, `docs/design.zh-CN.md`
- bundled finance workflow skills and workspace command seeds

## Boundaries

- keep reported facts, assumptions, and confidence levels separate
- prefer source-aware finance workflows over free-form market commentary
- keep this file short; deeper package notes belong in `docs/` and executable workflow details belong in the packaged skills
