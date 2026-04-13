---
name: office-spreadsheet-analysis
description: Analyze or update office spreadsheets with template awareness, dynamic formulas, and business-ready findings.
compatibility:
  - 'Works best when a workbook, CSV, or tabular export is the main source of truth.'
  - 'Pairs naturally with the bundled xlsx skill for reading, editing, and formula-safe output.'
---

# Office Spreadsheet Analysis

Use this skill when the job is not just "open Excel" but to understand a workbook, keep it trustworthy, and extract the signal.

## Use when

- A workbook, CSV, or spreadsheet export is the primary input.
- The user needs anomaly detection, period comparison, trend analysis, or a cleaned business summary.
- You need to edit an existing workbook without breaking formulas or conventions.

## Do not use when

- The real source of truth is a DOCX, PDF, or email thread and the spreadsheet is secondary.
- The user only wants a generic text summary with no spreadsheet handling.

## Spreadsheet rules that matter

- Preserve existing template and styling conventions when updating a workbook.
- Keep calculations dynamic. If a number should remain updateable, prefer formulas over hardcoded output.
- If formulas are introduced or changed, verify that no formula errors were created.
- Distinguish between raw data tabs, calculation tabs, and presentation tabs before changing anything.
- When one workbook is acting like a dataset rather than a presentation artifact, prefer DuckDB-style file querying for heavier exploration.

## Workflow

### Step 1: Read the workbook shape

Understand:

- which sheets are raw inputs
- which sheets are calculations
- which sheets are presentation outputs
- where assumptions live
- what date or period logic the workbook is using

Do not start editing cells blindly.

### Step 2: Decide the working mode

Choose one:

- analysis only
- data cleanup
- workbook update
- model extension

The working mode changes how aggressive you should be with edits.

### Step 3: Check trust before insight

Before reporting conclusions, validate:

- headers and units
- missing values
- duplicate rows
- formula integrity
- stale period or scenario assumptions

If the workbook is not trustworthy yet, say that before summarizing.

### Step 4: Run the analysis

Typical outputs:

- variance vs prior period
- rank / top contributors
- anomaly list
- trend summary
- segment comparison
- scenario or sensitivity readout

Keep business interpretation tied to what the sheet actually supports.

### Step 5: If editing, preserve future usefulness

When changing the workbook:

- put assumptions in separate cells where possible
- avoid baking calculations into values
- keep worksheet logic readable
- verify formulas after saving

## Output format

Return:

### 1. Workbook read

- key sheets
- likely source-of-truth tabs
- notable structural risks

### 2. Data quality check

- what looks reliable
- what needs caution

### 3. Findings

- main trends
- anomalies
- comparisons

### 4. If edits were made

- what changed
- why
- what still needs verification

## Use together with

- `xlsx` for file handling and workbook-safe operations
- `office-duckdb-read-file` and `office-duckdb-query` when spreadsheet work turns into multi-file or SQL-style analysis
- `office-source-reconciliation` when the numbers must be checked against documents or PDFs
