---
name: data-to-video
description: Turn CSV, JSON, spreadsheet extracts, tables, metrics, and report data into HyperFrames animated chart videos with data validation, chart recipes, labels, timing, renders, and QC.
---

# Data To Video

Use for animated data storytelling.

## Data Classification

Pick one:

- time series
- ranking
- comparison
- funnel
- cohort
- distribution
- geographic split
- metric dashboard

## Workflow

1. Inspect input data and identify dimensions, measures, dates, and missing values.
2. Choose chart recipe and story arc.
3. Normalize data into JSON/CSV under `docs/videos/assets/`.
4. Build scenes with explicit axes, labels, units, and color semantics.
5. Animate changes with frame-readable timing.
6. Render and QC.

## Rules

- Do not invent missing data.
- Record transformations in the brief.
- Keep labels readable at target resolution.
- Use semantic colors consistently.
- Avoid chart junk that hides the data.

## QC Risks

- axis truncation
- label overlap
- misleading interpolation
- unreadable small numbers
- incorrect units or date ranges
