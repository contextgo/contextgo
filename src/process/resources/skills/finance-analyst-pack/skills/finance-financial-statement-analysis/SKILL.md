---
name: finance-financial-statement-analysis
description: Analyze income statement, balance sheet, and cash flow together to assess financial health, earnings quality, and capital structure.
compatibility:
  - 'Works best when the user provides financial statements, management accounts, exported ledgers, or a finance workbook.'
  - 'Useful before deeper ratio work, valuation, or variance diagnosis because it establishes the real statement context first.'
---

# Finance Financial Statement Analysis

Use this skill when the task starts from financial statements rather than from a single metric.

## Use when

- The user shares financial statements or a finance workbook.
- A ratio or valuation discussion needs statement context first.
- The business question depends on how profit, cash, leverage, and working capital interact.

## Do not use when

- The task is only a quick KPI calculation.
- The user only needs document formatting.
- The source data is so incomplete that statement-level interpretation would be misleading.

## Core principle

Do not read the income statement in isolation.

Always connect:

- profit
- cash conversion
- balance-sheet strength
- capital intensity
- financing pressure

## Workflow

### 1. Establish period and source quality

Clarify:

- which periods are available
- whether the statements are actual, forecast, or management-adjusted
- whether any lines look stale, missing, or inconsistent

If the package is incomplete, say so before interpreting trends.

### 2. Read the income statement

Check:

- revenue trend and growth quality
- gross margin and operating leverage
- one-off items that distort operating performance
- whether margin movement looks structural or temporary

### 3. Read the cash flow with intent

Ask:

- is profit converting into cash
- what is happening in working capital
- how heavy is CapEx or reinvestment
- whether financing activity is masking operating weakness

### 4. Read the balance sheet for resilience

Focus on:

- liquidity
- leverage
- debt servicing pressure
- inventory, receivables, and payables changes
- equity quality and capital structure

### 5. Form the integrated view

The answer should explain:

- what is improving
- what is weakening
- what looks high quality
- what needs follow-up before confidence is high

## Output format

Return:

### 1. Statement frame

- periods covered
- source quality
- material gaps

### 2. Operating picture

- revenue and margin interpretation
- notable one-off issues

### 3. Cash and balance-sheet picture

- cash conversion
- leverage or liquidity observations
- working-capital signals

### 4. Integrated conclusion

- main strengths
- main risks
- most important next follow-up

## Use together with

- `finance-ratio-benchmarking`
- `finance-budget-variance-analysis`
- `finance-dcf-valuation`
- `office-duckdb-read-file`
