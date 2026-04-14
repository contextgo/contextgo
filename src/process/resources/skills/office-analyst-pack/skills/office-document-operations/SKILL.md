---
name: office-document-operations
description: Choose the right extraction or editing path for office documents such as PDF and DOCX without losing review context.
compatibility:
  - 'Works best when DOCX or PDF files are the main evidence source.'
  - 'Pairs with the bundled pdf and docx skills for actual document handling.'
---

# Office Document Operations

Use this skill when office documents need more than a quick skim.

## What this skill does

It helps choose the right path for reading, extracting, reviewing, or editing office documents.

## Use when

- PDFs or DOCX files are central to the task.
- The user needs table extraction, clean summaries, tracked review, or structured document changes.
- Multiple office documents need to be compared or synthesized.

## Do not use when

- The work is fundamentally spreadsheet-first.
- The user only needs a casual summary and no document fidelity matters.

## Decision tree

### Reading mode

Use when you need:

- a structured summary
- key clauses or decisions
- table extraction
- issue spotting

### Review mode

Use when the document is formal and changes should preserve review context:

- business memos
- contracts
- policy docs
- external-facing drafts

Default to a tracked or review-aware path instead of silent overwrites.

### Clean-output mode

Use when the user wants a polished final version with no visible review scaffolding.

## Workflow

### Step 1: Classify each file

For each document, identify:

- format: PDF or DOCX
- likely role: source evidence, draft for editing, final artifact, or appendix
- whether tables, comments, tracked changes, or form fields matter

### Step 2: Pick the extraction path

Examples:

- PDF with text and tables -> extract text and tables separately
- DOCX with business content -> preserve structure and review context
- DOCX draft for revision -> choose review-aware editing if external or formal

### Step 3: Preserve what matters

Do not accidentally erase:

- tracked changes
- comments
- section structure
- table layout that carries meaning

### Step 4: Convert extraction into a usable office output

Turn the raw extraction into:

- summary
- clause list
- action list
- issue register
- decision memo input

## Output format

Return:

### 1. File map

- each file
- role
- chosen processing path

### 2. Extracted signal

- main points
- important tables or structured content
- review context that should be preserved

### 3. Risks

- ambiguity
- missing pages or broken extraction
- review fidelity concerns

## Use together with

- `pdf`
- `docx`
- `office-briefing`
