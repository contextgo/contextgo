---
name: office-pdf-table-query
description: Extract tables from PDFs, assess extraction reliability, and analyze the structured result with DuckDB-style queries.
compatibility:
  - 'Works best when the user has tabular PDFs such as statements, reports, or appendices that need structured analysis.'
  - 'Useful when PDF tables must be compared with spreadsheets or queried like normal data files.'
---

# Office PDF Table Query

Use this skill when the PDF is not just reading material, but a table source that must become queryable data.

## Use when

- The PDF contains tables that need extraction and analysis.
- The user wants to compare PDF table contents against other structured files.
- A narrative summary is not enough because the task needs row-level or grouped analysis.

## Do not use when

- The PDF is mostly prose.
- The tables are obviously image-only and unreliable for automated extraction unless the user accepts OCR risk.
- The task can be solved by quoting or summarizing the PDF without structuring the tables.

## Core rule

Extract first, trust second, query third.

Do not treat a PDF-extracted table as source of truth until you assess extraction quality.

## Workflow

### 1. Inspect table extractability

Check:

- whether the PDF has selectable text
- whether tables have stable rows and columns
- whether merged headers, footnotes, or page breaks distort structure
- whether OCR is required

### 2. Normalize cautiously

After extraction:

- clean column names
- fix split rows or repeated headers
- preserve units and periods
- note any cells that may be truncated or misread

### 3. Assess reliability

Classify the extracted result as:

- reliable enough for direct analysis
- usable with caveats
- too weak for confident analysis

If reliability is weak, say so before running deeper queries.

### 4. Query with DuckDB-style analysis

Once structured data is credible enough:

- inspect schema
- bound the result size
- aggregate to answer the business question
- compare against any reference spreadsheet or memo if needed

### 5. Report findings with caveats

The final answer must include:

- what was extracted
- how reliable it seems
- what the query suggests
- which parts still need manual confirmation

## Output format

Return:

### 1. Extraction assessment

- PDF type
- extraction risks
- reliability level

### 2. Structured table view

- normalized table or schema summary
- important cleanup assumptions

### 3. Query findings

- bounded results
- interpretation

### 4. Caveats and next step

- what still needs manual review
- best follow-up query or validation

## Use together with

- `pdf`
- `office-document-operations`
- `office-duckdb-read-file`
- `office-duckdb-query`
