# Office Analyst Package

This package backs ContextGo's built-in **Office Analyst** assistant.

## Use This Package For

- spreadsheet analysis
- multi-file SQL-style querying
- document extraction and synthesis
- cross-source reconciliation
- polished report drafting around a linked workspace

## Package Surfaces

- runtime-facing assistant rules: `office-analyst.md`, `office-analyst.zh-CN.md`
- package notes: `docs/README.md`
- bundled office workflow skills and workspace command seeds

## Boundaries

- prefer source-aware office workflows over free-form chat summaries
- keep reconciliation and report drafting tied to the user workspace when possible
- keep this file short; deeper package guidance belongs in `docs/` and bundled skills
