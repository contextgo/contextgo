# Office Analyst Package Notes

This package contains ContextGo's built-in office productivity analysis bundle.

## Main Purpose

Office Analyst is designed for file-heavy office work where the user needs structured help across:

- spreadsheets
- exported data files
- PDFs
- DOCX files
- reconciliation and management reporting

## Package Surfaces

- `AGENTS.md`
  - runtime-facing rules entry document
- package root
  - `src/process/resources/assistant/office/office-analyst`
- skill source
  - `src/process/resources/skills/office-analyst-pack`
- bundled office workflow skills
  - spreadsheet analysis
  - DuckDB-style file querying
  - cross-file joins
  - data profiling
  - document summarization
  - source reconciliation
  - report drill-down
  - report drafting
  - PDF-table querying
- workspace command seeds matching those workflows

## Installation Surfaces

- `.contextgo/skills`
  - installs the office workflow skills declared by the preset package
- `.contextgo/commands.json`
  - seeded through the `office-analyst` workspace automation profile
- `.contextgo/schedules.json`
  - seeded by ContextGo with the standard conversation schedule container for this package
- runtime-native directories
  - only receive projected skills where a runtime-native skill folder is needed
- `.contextgo/hooks.json` and `.contextgo/hooks/`
  - this package does not currently contribute package-specific hook seeds

## Stable Package Behaviors

This package should keep favoring:

- explicit source-of-truth checks
- file-based analysis over unsupported guesswork
- bounded SQL-style analysis when data volume grows
- draft reports that preserve traceability back to source material

## Authoring Rule

Keep runtime assistant behavior in `AGENTS.md`, package notes in `docs/`, and operational file-processing logic in the packaged skills.

## Migration Status

The package root already owns:

- the runtime-facing rules entry document in `AGENTS.md`
- package entry routing
- package notes under `docs/`

The executable skill payload is currently sourced from `src/process/resources/skills/office-analyst-pack`.

That split is acceptable during migration as long as `.contextgo/` remains the installation source of truth and the runtime only receives projected skills.
