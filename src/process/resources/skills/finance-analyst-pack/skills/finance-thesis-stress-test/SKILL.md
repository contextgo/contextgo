---
name: finance-thesis-stress-test
description: Pressure-test an investment or operating thesis by attacking assumptions, downside paths, invalidation conditions, and monitoring triggers.
compatibility:
  - 'Works best when the user already has a thesis, recommendation, or favored view that needs to be challenged.'
  - 'Useful before committing capital, approving a plan, or socializing a high-conviction memo.'
---

# Finance Thesis Stress Test

Use this skill when the real job is not building the case, but trying to break it.

## Use when

- A thesis or recommendation already exists.
- The user wants to know what could make the thesis fail.
- A management or investment case needs stronger downside discipline.

## Do not use when

- No thesis exists yet.
- The task is only to summarize financial statements.
- The user wants comfort rather than challenge.

## Stress-test rules

- Attack the assumptions doing the most work.
- Distinguish thesis risk from valuation risk.
- Name invalidation conditions explicitly.
- End with monitoring triggers, not just abstract caution.

## Workflow

### 1. Restate the current thesis

Write the thesis as clearly as possible:

- what the user believes
- what must go right
- what valuation or outcome the view depends on

### 2. Identify the pressure points

Common stress points:

- revenue growth durability
- margin sustainability
- cash conversion
- leverage and refinancing risk
- customer concentration
- cyclical exposure
- management execution risk
- competitive response

### 3. Build downside paths

For each pressure point, ask:

- what if this assumption is too optimistic
- how quickly would the thesis weaken
- what would show up first in the numbers

### 4. Define invalidation and monitoring

The answer should explicitly state:

- what would invalidate the thesis
- what would reduce confidence
- what would increase conviction
- which metrics or events should be monitored next

## Output format

Return:

### 1. Thesis under review

- current thesis
- core assumptions

### 2. Pressure points

- assumption
- failure mode
- why it matters

### 3. Invalidation map

- what breaks the thesis
- what weakens it
- what would strengthen it

### 4. Monitoring triggers

- metrics or events to watch next

## Use together with

- `finance-dcf-valuation`
- `finance-investment-memo`
- `finance-investment-screening`
