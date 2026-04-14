---
name: office-source-reconciliation
description: Reconcile conflicting numbers and statements across spreadsheets, PDFs, and office documents before reporting out.
compatibility:
  - 'Works best when at least two office sources overlap on the same figures, claims, or decisions.'
  - 'Useful before final reports, management updates, or external sharing.'
---

# Office Source Reconciliation

Use this skill when the real work is not extraction, but deciding whether the sources agree.

## Use when

- A workbook, PDF, memo, or report all mention overlapping numbers.
- Version drift is possible.
- The user wants a reliable final summary, not just a merged pile of inputs.

## Do not use when

- Only one source matters.
- The task is pure drafting with no overlapping evidence.

## Reconciliation principles

- Never assume the newest file is automatically correct.
- Decide source of truth by role, not by convenience.
- Separate direct mismatches from interpretation mismatches.
- If a conflict cannot be resolved, carry it forward explicitly.

## Workflow

### Step 1: Build the overlap map

List:

- which files overlap
- which metrics or claims overlap
- what period or version each source appears to cover

### Step 2: Identify likely source-of-truth hierarchy

Common hierarchy examples:

- signed or finalized report over draft memo
- raw export over manually edited presentation tab
- approved finance workbook over narrative summary written from memory

If the hierarchy is unclear, say so and avoid overstating confidence.

### Step 3: Compare line by line

For each overlapping item:

- source A value
- source B value
- match / mismatch / ambiguous
- likely explanation

### Step 4: Produce the reconciled view

Return either:

- one clean reconciled figure set
- or a short unresolved conflict register

## Output format

Return:

### 1. Source map

- files compared
- likely source-of-truth ranking

### 2. Reconciliation table

- item
- source values
- status
- comment

### 3. Final recommendation

- what can be reported safely
- what still needs human confirmation

## Use together with

- `office-spreadsheet-analysis`
- `office-document-operations`
- `xlsx`, `pdf`, `docx`
