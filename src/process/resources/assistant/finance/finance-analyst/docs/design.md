# Finance Analyst Preset Design

This document captures the first-pass absorption plan for a future built-in `Finance Analyst` assistant preset.

It is intentionally first-party and distilled. The goal is not to import upstream bundles verbatim, but to absorb the strongest workflow patterns into a ContextGo-native preset that works well with linked workspaces, office files, and SQL-style analysis.

## Upstream references that were actually downloaded

### 1. `alirezarezvani/claude-skills`

- Local clone: `/Users/bytedance/contextgo/agent-repo/claude-skills`
- Commit: `ea9a8759f2d55d910400691b33bb398c937ad787`
- License: MIT

Primary finance sources reviewed:

- `finance/SKILL.md`
- `finance/financial-analyst/SKILL.md`
- `finance/financial-analyst/references/valuation-methodology.md`
- `finance/financial-analyst/references/financial-ratios-guide.md`
- `finance/saas-metrics-coach/SKILL.md`

### 2. `openclaw/skills`

- Local sparse clone: `/Users/bytedance/contextgo/agent-repo/openclaw-skills`
- Commit: `7da5a88549dc64c7fbbe367393203e92231f5d85`
- License: MIT

Primary valuation source reviewed:

- `skills/ndtchan/equity-valuation-framework/SKILL.md`

## Why this should become a separate built-in preset

`Office Analyst` already covers:

- spreadsheet and document handling
- file extraction
- multi-file SQL-style querying
- cross-source reconciliation
- polished office reporting

That is necessary but not sufficient for finance work.

`Finance Analyst` should sit one layer above `Office Analyst` and contribute:

- financial statement interpretation
- ratio analysis with benchmark logic
- budget vs actual variance diagnosis
- DCF and valuation triangulation
- forecast and scenario framing
- SaaS metrics and unit economics analysis
- investment memo and management-brief output discipline

In short:

- `Office Analyst` is the file-and-analysis substrate
- `Finance Analyst` is the financial judgment layer

## Distillation boundary

The preset should absorb the methodology, not the upstream scripts as-is.

### Keep

- ratio-analysis structure
- DCF workflow and sanity checks
- budget-variance framing
- forecast / scenario logic
- SaaS metrics benchmarking
- confidence and data-quality gates
- valuation report structure

### Do not import directly

- upstream Python script packages
- full upstream asset bundles and templates
- market-specific data-source assumptions such as VN stock pipelines
- investment-advice language that overreaches beyond educational analysis

### ContextGo-native adaptation

The preset should reuse existing ContextGo strengths:

- `xlsx`, `docx`, `pdf`
- `office-duckdb-read-file`
- `office-duckdb-query`
- `office-source-reconciliation`
- linked workspace commands

## Proposed preset identity

### Assistant id

- `builtin-finance-analyst`

### Display name

- `Finance Analyst`

### Domain

- `Finance & Planning`

### Positioning

A built-in finance decision-support assistant for financial statements, variance reviews, valuation work, rolling forecasts, SaaS metrics, and executive financial reporting around a linked workspace.

## Proposed first-party distilled skill pack

Suggested package name:

- `finance-analyst-pack`

### Core v1 skills

1. `finance-financial-statement-analysis`

- Read income statement, balance sheet, cash flow, and ratio context together.
- Focus on trend, quality of earnings, leverage, liquidity, and working-capital interpretation.

2. `finance-ratio-benchmarking`

- Calculate and interpret ratio groups.
- Match benchmarks to company type and call out denominator or accounting caveats.

3. `finance-budget-variance-analysis`

- Explain actual vs budget vs prior-period movement.
- Emphasize materiality thresholds, favorable/unfavorable logic, and driver isolation.

4. `finance-dcf-valuation`

- Build a first-party DCF workflow.
- Require explicit assumptions, scenario ranges, sensitivity grids, and sanity checks against multiples.

5. `finance-forecast-scenario-planning`

- Create rolling forecasts and base/bull/bear scenarios.
- Make assumption changes visible instead of hiding them inside opaque spreadsheets.

6. `finance-saas-metrics`

- Cover ARR, MRR growth, churn, CAC, LTV, CAC payback, NRR, quick ratio, and unit economics.
- Use stage- and segment-aware benchmarking instead of one-size-fits-all thresholds.

### High-value v1.5 add-ons

7. `finance-comparable-valuation`

- Relative valuation using peer multiples and company-history ranges.

8. `finance-investment-memo`

- Turn financial analysis into a disciplined management note or investment memo with thesis, risks, confidence, and data gaps.

## Proposed default enabled skills

The preset should likely enable:

- `xlsx`
- `docx`
- `pdf`
- `office-duckdb-read-file`
- `office-duckdb-query`
- `office-source-reconciliation`
- `finance-financial-statement-analysis`
- `finance-ratio-benchmarking`
- `finance-budget-variance-analysis`
- `finance-dcf-valuation`
- `finance-forecast-scenario-planning`
- `finance-saas-metrics`
- `finance-investment-memo`

## Proposed workspace commands

These commands should feel like finance workflows, not generic office commands.

### 1. `analyze-financials`

Use:

- `finance-financial-statement-analysis`
- `finance-ratio-benchmarking`
- `office-duckdb-read-file`
- `xlsx`

Intent:

- Inspect a workbook or export containing financial statements
- summarize health, trend, and risk
- identify what needs deeper follow-up

### 2. `explain-variance`

Use:

- `finance-budget-variance-analysis`
- `office-duckdb-query`
- `office-source-reconciliation`

Intent:

- Start from budget vs actual or prior-period movement
- isolate material drivers
- explain what moved and why confidence is or is not strong

### 3. `build-dcf`

Use:

- `finance-dcf-valuation`
- `finance-comparable-valuation`
- `office-duckdb-query`

Intent:

- Turn available financial inputs into a decision-grade valuation range
- include sensitivity and assumption disclosure

### 4. `forecast-business`

Use:

- `finance-forecast-scenario-planning`
- `office-duckdb-query`
- `xlsx`

Intent:

- Build a base/bull/bear forecast
- expose the operational drivers and assumption changes

### 5. `benchmark-saas`

Use:

- `finance-saas-metrics`
- `office-duckdb-query`

Intent:

- Turn raw SaaS operating numbers into a health report
- benchmark by segment and stage
- prioritize what to fix first

### 6. `write-investment-memo`

Use:

- `finance-investment-memo`
- `finance-dcf-valuation`
- `finance-ratio-benchmarking`
- `docx`

Intent:

- Produce a disciplined memo or management brief with thesis, valuation, risks, confidence, and explicit gaps

## Expected preset behavior

The assistant should consistently do the following:

- separate reported facts from inferred assumptions
- distinguish precise valuation from directional valuation
- downgrade confidence when inputs are incomplete or stale
- avoid presenting a single-point valuation as certainty
- translate analysis into decision-ready language instead of spreadsheet-only output

## Output standards to preserve

The strongest ideas worth preserving from the upstream material are:

- confidence tiers
- explicit data-quality gate
- scenario-based valuation and forecasting
- sensitivity analysis
- business-quality checklist
- risk register
- margin-of-safety framing

These should become ContextGo-specific reporting conventions.

## Recommended implementation shape

### Preset surface

- assistant rules under `src/process/resources/assistant/finance/finance-analyst/`
- packaged skills under `src/process/resources/skills/finance-analyst-pack/`
- workspace command profile in `workspaceAutomation.ts`
- preset registration in `assistantPresets.ts`

### Suggested implementation order

1. Add the built-in preset shell and workspace commands.
2. Write 4-6 core first-party skills first.
3. Reuse `Office Analyst` file-query stack instead of creating a second data-ingestion layer.
4. Add one first-party `THIRD_PARTY_NOTICES.md` for the absorbed MIT sources.
5. Only after v1 is stable, consider sector packs such as banking, manufacturing, or private-company M&A.

## Explicit non-goals for v1

- real-time market data fetching
- brokerage or portfolio execution
- personalized investment advice
- country-specific regulatory or tax compliance workflows
- full sector specialization for banks, insurance, or distressed assets

## Recommended first implementation slice

If we implement this preset next, the smallest convincing v1 is:

- preset shell
- 6 core skills
- 6 finance commands
- no heavy upstream script import
- rely on first-party distilled prompts plus existing office and DuckDB capabilities

That would be enough to prove that `Finance Analyst` is a real product surface, not just an `Office Analyst` skin with finance vocabulary.
