---
name: office-duckdb-install
description: Install or update DuckDB CLI and required extensions so office data files can be queried directly with SQL.
compatibility:
  - 'Use when DuckDB is missing or an office data task needs extensions such as httpfs, spatial, sqlite_scanner, or xlsx support.'
---

# Office DuckDB Install

This skill is absorbed from the DuckDB official install workflow and adapted for ContextGo office tasks.

## What it is for

Use this skill when DuckDB itself is missing or when a file reader depends on extensions.

## Use when

- `duckdb` command is missing
- a file read or query fails because an extension is not installed
- the user wants DuckDB updated before doing analysis

## Workflow

### Step 1: Check whether DuckDB exists

If the CLI is not installed, provide the platform-specific path:

- macOS: `brew install duckdb`
- Linux: installer script from DuckDB
- Windows: `winget install DuckDB.cli`

### Step 2: Identify what must be installed

Common office analysis cases:

- `httpfs` for remote files
- `spatial` for spatial file formats
- `sqlite_scanner` for SQLite reads
- Excel-related reader support when needed by the local DuckDB build

### Step 3: Install or update safely

Prefer explicit installs and report what changed.

### Step 4: Hand control back to the analysis skill

Once DuckDB is ready, continue with:

- `office-duckdb-read-file`
- `office-duckdb-query`

## Output format

Return:

### 1. Status

- installed / missing / outdated

### 2. Required extensions

- what is needed
- why

### 3. Next step

- exact command or continuation path

## Use together with

- `office-duckdb-read-file`
- `office-duckdb-query`
