---
name: finance-investment-memo
description: Convert finance analysis into a structured investment memo or management brief with thesis, valuation view, risk register, confidence, and explicit gaps.
compatibility:
  - 'Works best when financial analysis is already underway and the user needs a decision-ready output.'
  - 'Useful for investment reviews, board notes, acquisition screening, or executive finance briefings.'
---

# Finance Investment Memo

Use this skill when the final deliverable matters as much as the analysis.

## Use when

- The user needs a memo, board note, or investment-style brief.
- Finance findings must be communicated to decision-makers.
- The deliverable must preserve assumptions, risks, and uncertainty instead of oversimplifying them.

## Do not use when

- Analysis is still too raw to summarize honestly.
- The task is just to calculate a metric.
- The user needs a legal recommendation or personalized investment advice.

## Memo rules

- Separate facts, assumptions, and inference.
- Keep the thesis short enough to defend.
- Include both upside and invalidation conditions.
- Make confidence and missing data visible.

## Workflow

### 1. Lock the memo purpose

Decide whether this is:

- investment screening
- internal management review
- valuation memo
- board update

### 2. Build the core sections

At minimum, include:

- executive summary
- what data was used
- core thesis
- valuation or performance view
- business-quality and risk assessment
- confidence and gaps

### 3. Keep the conclusion conditional

The close should say:

- what supports the view
- what weakens it
- what new evidence would change the stance

## Output format

Return:

### 1. Executive summary

- one short paragraph

### 2. Data used

- files, periods, and source caveats

### 3. Thesis

- why the business or decision matters
- what must go right

### 4. Analysis summary

- valuation, performance, or scenario highlights

### 5. Risk register

- ranked risks
- monitoring triggers

### 6. Confidence and gaps

- confidence level
- exact gaps that still matter

## Use together with

- `finance-dcf-valuation`
- `finance-financial-statement-analysis`
- `finance-saas-metrics`
- `docx`
