---
name: office-cross-file-join-analysis
description: Join and compare multiple office data files with grain checks, coverage diagnostics, and business-facing conclusions.
compatibility:
  - 'Works best when two or more CSV, Excel, Parquet, or similar tabular files need to be matched on shared keys.'
  - 'Useful for sales vs finance reconciliation, plan vs actual analysis, CRM to billing checks, or master-data enrichment.'
---

# Office Cross-File Join Analysis

Use this skill when the task is not just querying files independently, but connecting them safely.

## Use when

- The user needs a join across multiple files.
- The business question depends on matching entities, periods, or transactions between sources.
- Join quality matters as much as the final metric.

## Do not use when

- A single file is enough.
- The files obviously do not share a stable key.
- The user only needs a quick schema inspection.

## Core rule

A join is only trustworthy when the grain and key logic are explicit.

Do not jump straight to SQL. First prove:

- what each file represents
- what one row means in each file
- which columns can really join
- whether one-to-many or many-to-many expansion is acceptable

## Workflow

### 1. Inspect grain before joining

For each file, identify:

- business entity per row
- time grain if relevant
- likely primary key or composite key
- duplicate risk on the proposed join keys

If the grain is mismatched, say so before joining.

### 2. Pick the join strategy deliberately

Choose from:

- exact entity join
- entity plus period join
- lookup enrichment join
- staged join with pre-aggregation first

If raw joins would multiply rows, aggregate or deduplicate before joining.

### 3. Validate coverage

Before focusing on metrics, measure:

- matched rows
- unmatched left-side rows
- unmatched right-side rows
- duplicate or exploding matches

Coverage diagnostics are part of the answer, not optional debug output.

### 4. Run bounded join analysis

Use DuckDB-friendly SQL to:

- inspect key cardinality
- join with explicit select lists
- surface mismatches or gaps
- aggregate to the business level the user actually cares about

### 5. Explain business meaning

Translate the join result into business language:

- what matched cleanly
- what did not match
- whether the mismatch suggests missing data, timing drift, or process issues

Do not stop at raw SQL output.

## Output format

Return:

### 1. Join design

- files involved
- chosen join keys
- grain assumptions

### 2. Coverage diagnostics

- match rate
- unmatched or duplicate patterns
- caveats

### 3. Business findings

- what the joined analysis shows
- what decisions are safe or unsafe from the result

### 4. Next best check

- one focused follow-up query or validation

## Use together with

- `office-duckdb-read-file`
- `office-duckdb-query`
- `office-source-reconciliation`
