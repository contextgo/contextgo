---
name: finance-dcf-valuation
description: Build a decision-grade valuation view with explicit assumptions, DCF logic, multiples sanity checks, confidence tiers, and margin-of-safety framing.
compatibility:
  - 'Works best when the user has enough historical and projected financial inputs to support valuation work.'
  - 'Useful for investment review, acquisition screening, internal fair-value discussion, or thesis pressure-testing.'
---

# Finance DCF Valuation

Use this skill when the user needs a valuation workflow, not just a number.

## Use when

- The user asks whether a business or asset appears undervalued, fairly valued, or stretched.
- A DCF or scenario-based fair-value view is needed.
- The task requires explicit assumptions and sensitivity rather than intuition.

## Do not use when

- Inputs are too weak for any serious cash-flow view.
- The request is purely accounting analysis with no valuation angle.
- The user expects real-time market data that is not available in the current files.

## Core valuation rules

- Start with a data-quality gate.
- State all critical assumptions explicitly.
- Use bull, base, and bear scenarios.
- Cross-check DCF outputs against relative valuation sanity bounds.
- Present ranges, confidence, and gaps instead of pretending a point estimate is truth.

## Workflow

### 1. Run the input quality gate

Check:

- freshness of the periods
- completeness of revenue, margin, cash flow, debt, cash, and share inputs
- consistency of the statement package

If the data is weak, downgrade to directional valuation.

### 2. Build the valuation logic

At minimum, make explicit:

- forecast horizon
- revenue path
- margin path
- reinvestment and working-capital assumptions
- discount-rate logic
- terminal-value method

### 3. Scenario the result

Always provide:

- bull
- base
- bear

Each scenario should state what changes and why.

### 4. Run sensitivity and sanity checks

Sensitivity should cover at least:

- discount rate
- terminal growth or exit assumption

Sanity checks should ask:

- does the implied range make sense against market or peer multiples
- is terminal value dominating too much
- are the assumptions drifting into optimism rather than analysis

### 5. Conclude with confidence and safety zone

The final answer should say:

- fair-value range
- confidence level
- key gaps that could move the conclusion
- margin-of-safety discipline

Do not issue personalized investment advice.

## Output format

Return:

### 1. Data quality gate

- freshness
- completeness
- confidence tier

### 2. Scenario assumptions

- bull
- base
- bear

### 3. Valuation work

- DCF summary
- sanity-check view
- sensitivity summary

### 4. Fair-value view

- range
- safety zone
- what would change the view materially

## Use together with

- `finance-financial-statement-analysis`
- `finance-ratio-benchmarking`
- `finance-investment-memo`
