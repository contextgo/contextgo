---
name: finance-comparable-valuation
description: Compare companies on a consistent valuation, quality, and business-model frame instead of a loose side-by-side scorecard.
compatibility:
  - 'Works best when the user wants to compare two or more companies, assets, or candidates using a shared valuation lens.'
  - 'Useful for stock comparison, acquisition screening, internal capital allocation, and board-level tradeoff discussions.'
---

# Finance Comparable Valuation

Use this skill when the question is not just "what is this worth?" but "how does it stack up against alternatives?"

## Use when

- The user wants to compare multiple companies or candidates.
- The discussion depends on relative valuation, growth quality, margins, or balance-sheet strength.
- A decision requires a consistent side-by-side framework.

## Do not use when

- Only one company matters.
- The comparison set is too inconsistent to support a fair benchmark.
- The task is a pure DCF build with no relative lens.

## Comparison rules

- Normalize the frame before judging the result.
- Compare like with like on period, scale, business model, and capital intensity.
- Do not let one headline multiple decide the whole conclusion.
- Call out when one candidate is cheaper for a reason.

## Workflow

### 1. Set the comparison frame

Clarify:

- which companies are in scope
- which periods are comparable
- whether the comparison is about valuation, quality, growth, risk, or all of them

### 2. Choose the right lenses

Potential lenses:

- profitability and margin quality
- growth durability
- leverage and liquidity
- cash conversion
- valuation multiples
- business quality and resilience

### 3. Normalize and compare

For each important lens:

- use the same basis across candidates
- identify outliers and reasons
- separate cheapness from real quality

### 4. Conclude with tradeoffs

The answer should explain:

- who looks stronger on quality
- who looks more attractive on valuation
- where the market may be over- or under-pricing risk
- what extra diligence would change the ranking

## Output format

Return:

### 1. Comparison frame

- candidates
- period basis
- key assumptions

### 2. Side-by-side comparison

- metric or lens
- candidate observations
- notable gaps or caveats

### 3. Relative conclusion

- strongest candidate and why
- cheapest candidate and why
- where the tradeoff is real rather than cosmetic

## Use together with

- `finance-ratio-benchmarking`
- `finance-dcf-valuation`
- `finance-investment-screening`
