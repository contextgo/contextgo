---
name: finance-investment-screening
description: Screen businesses or opportunities through explicit valuation, quality, balance-sheet, and confidence gates before deeper diligence.
compatibility:
  - 'Works best when the user needs a first-pass filter across one or more investment or capital-allocation candidates.'
  - 'Useful for watchlists, acquisition pipelines, thesis triage, and prioritizing due diligence.'
---

# Finance Investment Screening

Use this skill when the right output is a disciplined filter, not a full memo for every candidate.

## Use when

- The user wants to screen several ideas or opportunities.
- You need to decide what deserves deeper diligence.
- Data quality varies across candidates and confidence must be part of the screen.

## Do not use when

- The user already wants a full deep-dive memo on one candidate.
- No meaningful screening criteria can be defined.
- The available inputs are too thin even for directional gating.

## Screening rules

- Define the gates before screening the names.
- A candidate can fail for valuation, quality, leverage, or confidence reasons.
- Missing data is a real screening factor, not a footnote.
- Classification should be simple and decision-oriented.

## Workflow

### 1. Define the gates

Typical gates:

- valuation attractiveness
- business quality
- balance-sheet resilience
- execution or cycle risk
- confidence or data quality

### 2. Run the first-pass filter

For each candidate, classify whether it looks:

- attractive
- watchlist
- caution

### 3. Explain the blocking factor

If a candidate does not clear the bar, say whether the blocker is:

- too expensive
- weak quality
- fragile balance sheet
- low confidence due to missing data

### 4. Rank next-step priority

State:

- which candidate deserves deeper diligence first
- which should remain on a watchlist
- which should be deprioritized

## Output format

Return:

### 1. Screening criteria

- gates used
- threshold logic

### 2. Candidate screen

- candidate
- classification
- main pass/fail reason
- confidence level

### 3. Priority order

- who deserves deeper work first
- what exact data would change borderline cases

## Use together with

- `finance-comparable-valuation`
- `finance-dcf-valuation`
- `finance-thesis-stress-test`
