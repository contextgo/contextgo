---
name: office-duckdb-read-file
description: Inspect a data file with DuckDB to learn its schema, row count, sample rows, and what to query next.
compatibility:
  - 'Works best for CSV, JSON, Parquet, Excel, SQLite, and similar file-based datasets.'
  - 'Requires DuckDB CLI. Pair with office-duckdb-install if DuckDB or a needed extension is unavailable.'
---

# Office DuckDB Read File

This skill is absorbed from the DuckDB official `read-file` workflow and adapted to ContextGo office analysis.

## What it is for

Before writing queries, profile the file properly:

- what columns exist
- what row count looks like
- what the sample values suggest
- which reader or extension is needed

## Use when

- The user asks what is inside a data file.
- You need to inspect a CSV, Parquet, JSON, Excel, SQLite, or similar file before deeper analysis.
- You want a file-aware profile before moving to SQL-style querying.

## Do not use when

- The data model is already understood and the user is clearly asking for a query result.
- The task is centered on office documents rather than data files.

## Workflow

### Step 1: Resolve the file

Make sure the path or URL is real and identify:

- local or remote
- likely file type
- whether an extension may be needed

### Step 2: Read with the right strategy

Use DuckDB's file readers or a `read_any` style macro mindset:

- CSV / TSV
- JSON
- Parquet
- Excel
- SQLite
- remote object storage when needed

If the generic path fails, switch to the exact reader instead of guessing blindly.

### Step 3: Profile the file

Always try to produce:

- schema
- row count
- sample rows

This is the minimum useful profile.

### Step 4: Turn the profile into next questions

After profiling, say:

- what the file most likely represents
- what quality issues are visible
- which query should come next

## Output format

Return:

### 1. File profile

- file type
- likely content
- schema

### 2. Volume and sample

- row count
- sample notes

### 3. Data quality watchpoints

- missing values
- odd types
- suspicious fields

### 4. Recommended next query

- one or two SQL-style follow-ups

## Use together with

- `office-duckdb-query`
- `office-duckdb-install`
- `office-spreadsheet-analysis` when the file is an Excel workbook acting as a dataset
