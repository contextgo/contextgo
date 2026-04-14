---
name: office-duckdb-query
description: Run SQL-style analysis across local files with DuckDB, using bounded results and file-aware query planning.
compatibility:
  - 'Works best when the user needs SQL-style analysis across CSV, Parquet, JSON, Excel, or other tabular data files.'
  - 'Requires DuckDB CLI. Pair with office-duckdb-install when DuckDB or an extension is missing.'
---

# Office DuckDB Query

This skill is absorbed from the real DuckDB official skill design, then adapted for ContextGo office workflows.

## What it is for

Use DuckDB as the query engine when office work turns into:

- multiple data files
- large tabular exports
- SQL-style slicing and aggregation
- direct file querying without importing into a separate database first

## Use when

- The user wants to ask questions across CSV, Parquet, JSON, Excel, or similar files.
- A normal spreadsheet summary is too weak for the scale or shape of the data.
- SQL is the clearest way to compare, aggregate, filter, or join the inputs.

## Do not use when

- The task is a simple single-sheet inspection that can be answered faster with workbook reading.
- The user mainly needs document extraction rather than data querying.

## Core operating model

### 1. Choose the query mode

Use one of these modes:

- direct file query
- query against an attached DuckDB database
- mixed mode where a database and files both matter

For office analysis, direct file query is the default unless the user already has a DuckDB database.

### 2. Verify DuckDB is available

Check for the CLI first. If missing, use `office-duckdb-install`.

### 3. Prefer Friendly SQL

Adopt DuckDB-friendly patterns:

- `FROM 'file.csv'`
- `GROUP BY ALL`
- `ORDER BY ALL`
- `SELECT * EXCLUDE (...)`
- `DESCRIBE`
- `SUMMARIZE`

This keeps queries short, readable, and easy to iterate.

### 4. Bound the result set

Before running a query that could explode in size:

- inspect row count
- add `LIMIT`
- aggregate first if possible

Do not dump a million-row result into the conversation.

### 5. Interpret, do not just print

After executing a query, explain:

- what the result means
- what caveat matters
- what follow-up query is most useful next

## Error handling expectations

- missing DuckDB -> install path
- missing extension -> install and load the needed extension, then retry
- file not found -> resolve the path before guessing
- syntax error -> fix the query instead of giving up

## Friendly SQL reminders

Prefer:

- direct file reads like `FROM 'sales.parquet'`
- `count()` instead of `count(*)`
- `DESCRIBE` for schema
- `SUMMARIZE` for quick profiling
- explicit bounded outputs

## Output format

Return:

### 1. Query plan

- files or databases involved
- query mode
- assumptions

### 2. SQL used

- final SQL or query shape

### 3. Results

- bounded result
- interpretation

### 4. Next useful query

- one or two high-value follow-ups

## Use together with

- `office-duckdb-read-file` to inspect a file before querying
- `office-duckdb-install` if DuckDB or extensions are missing
- `office-source-reconciliation` when query results must be matched against office documents
