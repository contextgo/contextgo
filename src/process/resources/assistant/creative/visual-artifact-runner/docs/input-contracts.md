# Input Contracts

The Visual Artifact Runner accepts the following normalized input shapes. All
skills must classify the input against this list before executing a recipe.

## 1. Brief Input

A short, structured planning document. Typical fields:

- `topic` - one-line subject of the artifact
- `audience` - who the artifact is for
- `goal` - what the audience should do or feel
- `key_messages` - ordered list of headline claims
- `evidence` - supporting facts or data points
- `tone` - voice and atmosphere descriptors
- `constraints` - mandatory rules (length, theme, embargo)

Used by: `deck-from-brief`, `report-to-infographic`.

## 2. Report Input

A long-form report or markdown document with sections, headings, and embedded
data. The runner must extract:

- the executive thesis
- 3 to 7 supporting sections
- numeric or comparative tables worth visualizing
- any quoted insights worth surfacing as a callout

Used by: `deck-from-report`, `report-to-infographic`.

## 3. PDF Input

A binary PDF that may be either a structured report or a scanned document.

The runner must:

- run a structure check before content extraction
- choose between **summary distillation** and **visual reconstruction** (see
  `quality-checks.md` for the routing rules)
- preserve page citations when summarizing

Used by: `pdf-to-deck`.

## 4. Structured Data Input

A JSON, CSV, or markdown table that needs to be turned into an infographic or
visual handout.

The runner must:

- detect the data shape (time series, ranking, matrix, distribution)
- pick a chart family that matches the shape
- emit a layout plan that places the chart inside the chosen recipe

Used by: `report-to-infographic`.

## 5. Theme Override Input

An optional secondary input carrying:

- a theme id from the package theme catalog, or
- an inline theme spec (palette, typography, spacing, motion preferences)

Theme overrides are layered after recipe selection and before export. They never
bypass QC.

Used by: `deck-theme-apply`.

## Normalization Rules

- the runner must reject inputs that omit required fields instead of guessing
- the runner must record the resolved input shape in the build note for traceability
- when an input mixes shapes (for example a brief that embeds a data table) the
  runner should split it into a primary shape plus an attached secondary shape
