---
name: finance-budget-variance-analysis
description: Explain actual versus budget or prior-period performance with materiality thresholds, driver logic, and management-ready conclusions.
compatibility:
  - 'Works best when the user has actual, budget, forecast, or prior-period numbers and wants to know what really moved.'
  - 'Useful for monthly business review, department spend control, revenue bridge analysis, and board prep.'
---

# Finance Budget Variance Analysis

Use this skill when the finance task is really about movement and explanation.

## Use when

- The user asks why actuals missed or beat plan.
- Management wants a clean bridge from top-line movement to root drivers.
- You need a defensible explanation of variance rather than a raw table.

## Do not use when

- There is no comparison basis.
- The movement is immaterial and the task is really just reporting.
- Source files are too inconsistent to tell whether the numbers align.

## Variance rules

- Start with materiality, not with every line item.
- Favorable or unfavorable depends on the line type.
- Separate volume, price, mix, timing, and one-off effects where possible.
- Do not over-explain immaterial noise.

## Workflow

### 1. Set the comparison frame

Clarify:

- actual vs budget, forecast, or prior period
- month, quarter, year, or rolling view
- the materiality threshold

If the threshold is not given, propose one and say so.

### 2. Identify the few variances that matter

Rank by:

- absolute dollar impact
- percentage deviation
- business relevance

The answer should center on the biggest drivers, not every row.

### 3. Explain the drivers

For each material variance, test whether it comes from:

- volume
- price or rate
- mix
- timing
- one-off or accounting reclassification

### 4. Close with control signals

End by stating:

- what is a short-term variance
- what is structural
- what needs operating follow-up
- what should change in the forecast

## Output format

Return:

### 1. Variance frame

- comparison basis
- threshold
- scope

### 2. Material drivers

- line or area
- variance amount and direction
- likely explanation
- confidence level

### 3. Management readout

- what truly moved
- what is noise
- what follow-up or reforecast is needed

## Use together with

- `finance-financial-statement-analysis`
- `office-source-reconciliation`
- `office-duckdb-query`
