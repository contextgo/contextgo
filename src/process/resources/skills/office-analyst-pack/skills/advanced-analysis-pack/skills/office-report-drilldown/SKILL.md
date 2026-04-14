---
name: office-report-drilldown
description: Drill from top-line operating metrics into segments, drivers, and anomalies without overstating causality.
compatibility:
  - 'Works best when the user starts with a KPI, management summary, or operating report and needs to understand what moved underneath it.'
  - 'Useful for revenue, margin, cost, conversion, utilization, and other recurring business metrics.'
---

# Office Report Drilldown

Use this skill when the user has a headline number and needs the path from summary to drivers.

## Use when

- The task starts from a KPI or management report.
- The user wants to know what changed, where it changed, and what likely drove it.
- A layered drill-down is more useful than a flat descriptive summary.

## Do not use when

- No top-line metric is defined.
- The source data is too weak to support segmented analysis.
- The user only wants formatting help on the report.

## Drill-down principles

- Start from the reported KPI, not from random slicing.
- Move from top line to segment to driver in a controlled sequence.
- Distinguish variance explanation from root-cause proof.
- Do not present correlation as causation.

## Workflow

### 1. Lock the metric definition

Clarify:

- exact KPI
- period and comparison basis
- numerator and denominator if applicable
- whether the report reflects booked, billed, recognized, forecast, or estimated numbers

### 2. Find the first useful cut

Choose the highest-signal split, such as:

- business unit
- region
- product line
- channel
- customer segment
- time bucket

Use the split that best explains movement, not the one that is easiest to compute.

### 3. Quantify variance contribution

Break the movement into:

- biggest positive contributors
- biggest negative contributors
- mix effect vs volume effect when possible
- anomalies that need separate explanation

### 4. Test the likely driver path

For each major movement, ask:

- is this broad-based or concentrated
- is it one-off or recurring
- does it align with known business events
- what evidence is still missing for a stronger claim

### 5. Close with decision-ready language

The final answer should say:

- what moved
- what most likely drove it
- what remains uncertain
- what follow-up analysis would resolve the uncertainty

## Output format

Return:

### 1. KPI frame

- metric
- comparison period
- source assumptions

### 2. Drill-down path

- segment cuts used
- why those cuts matter

### 3. Main drivers

- ranked contributors
- anomalies
- confidence level

### 4. Recommended next query

- one or two targeted checks for stronger root-cause confidence

## Use together with

- `office-duckdb-query`
- `office-source-reconciliation`
- `office-briefing`
