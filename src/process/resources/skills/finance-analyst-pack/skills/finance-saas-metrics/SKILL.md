---
name: finance-saas-metrics
description: Turn raw SaaS operating numbers into a benchmarked health report with prioritized fixes and unit-economics judgment.
compatibility:
  - 'Works best when the user provides revenue and customer metrics such as MRR, churn, CAC, NRR, or payback.'
  - 'Useful for SaaS founders, finance leads, growth teams, and board-prep reviews.'
---

# Finance SaaS Metrics

Use this skill when the business is recurring-revenue driven and the key question is health, not just accounting.

## Use when

- The user shares MRR, ARR, customer, churn, CAC, LTV, or NRR inputs.
- A SaaS health report or unit-economics readout is needed.
- Benchmarks should be interpreted by stage and segment.

## Do not use when

- The company is not meaningfully SaaS-like.
- The task is a traditional statement-only review.
- The user lacks enough operating inputs for even directional SaaS analysis.

## SaaS rules

- Work with partial data, but name the missing inputs explicitly.
- Stage and segment matter: SMB, enterprise, PLG, early-stage, and scale-stage should not be benchmarked the same way.
- Prioritize at most 2-3 broken metrics.
- If growth efficiency is weak, say it clearly.

## Workflow

### 1. Establish the business context

Clarify:

- segment
- stage
- pricing model
- whether metrics are gross or net of churn and expansion

### 2. Calculate the important metrics

Aim to interpret:

- ARR
- MRR growth
- churn
- CAC
- LTV
- LTV:CAC
- CAC payback
- NRR
- quick ratio

### 3. Benchmark with context

For each important metric:

- compare against the right benchmark frame
- label it clearly
- explain why it matters

### 4. Prioritize action

Pick the few metrics that deserve immediate attention and explain:

- what is happening
- why it matters
- what should be fixed first

## Output format

Return:

### 1. Metrics at a glance

- metric
- value
- benchmark context
- status

### 2. Overall picture

- short plain-English summary

### 3. Priority issues

- what is broken or weak
- why it matters
- what to do next

### 4. What is working

- one or two real strengths

## Use together with

- `finance-forecast-scenario-planning`
- `office-duckdb-query`
