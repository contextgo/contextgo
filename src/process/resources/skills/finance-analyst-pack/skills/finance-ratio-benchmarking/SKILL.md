---
name: finance-ratio-benchmarking
description: Calculate and interpret financial ratios with business-model-aware benchmarks, caveats, and follow-up questions.
compatibility:
  - 'Works best when the user needs ratio interpretation, benchmarking, or financial-health classification.'
  - 'Useful for management review, lender-style analysis, investor discussions, and board preparation.'
---

# Finance Ratio Benchmarking

Use this skill when the user needs ratios that mean something, not just formulas.

## Use when

- The user asks whether margins, liquidity, leverage, or return metrics are good or bad.
- Benchmarking against peers, stage, or history matters.
- A statement pack is available and ratios must be explained in plain language.

## Do not use when

- A single raw metric is enough.
- The underlying numbers are too weak to support meaningful ratio work.
- The user mainly needs valuation rather than ratio interpretation.

## Ratio discipline

- Never benchmark without stating the business context.
- Compare like with like: industry, stage, margin profile, and capital intensity matter.
- Call out denominator risk, one-off items, and accounting distortions.
- A label such as `healthy` is only valid when the assumptions behind it are visible.

## Workflow

### 1. Choose the ratio lens

Group the work into:

- profitability
- liquidity
- leverage
- efficiency
- valuation context

Do not dump every available ratio if only two categories matter.

### 2. Check data quality first

Before calculating or interpreting:

- confirm the period basis
- identify missing lines
- note unusual items that can distort the denominator

### 3. Benchmark deliberately

Compare each important ratio against:

- company history
- peer or industry norms
- the business model and stage

If those benchmarks disagree, explain why.

### 4. Translate to judgment

For each important ratio, explain:

- what it says
- what caveat matters
- what follow-up question it creates

## Output format

Return:

### 1. Benchmark frame

- company type
- period basis
- benchmark assumptions

### 2. Key ratios

- ratio
- current value
- benchmark or reference range
- interpretation
- caveat

### 3. Overall read

- strongest signals
- weakest signals
- what needs deeper analysis next

## Use together with

- `finance-financial-statement-analysis`
- `finance-budget-variance-analysis`
- `finance-dcf-valuation`
