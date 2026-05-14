# Layout Recipes

Layout recipes define how a normalized input is mapped onto a visual artifact.
The runner selects exactly one primary recipe per execution.

## Recipe Catalog

### Deck Recipes

- `deck.pyramid` - top-down decision deck driven by the Pyramid Principle
- `deck.scqa` - situation / complication / question / answer narrative
- `deck.case-study` - problem / approach / outcome storytelling for sales or review
- `deck.exec-summary` - 5 to 8 slide condensed deck for executive review
- `deck.report-summary` - distillation of a long report into a presentation flow

### PDF Recipes

- `pdf.report-cover` - report cover plus structured table of contents
- `pdf.handout-grid` - multi-column handout grid with sidebars and callouts
- `pdf.brief-onepager` - condensed one-page brief

### Infographic Recipes

- `infographic.timeline` - chronological story with milestones and annotations
- `infographic.comparison` - two-axis or side-by-side comparison
- `infographic.process` - linear or branching process explainer
- `infographic.dashboard` - mixed KPI / chart layout with explanatory copy

## Selection Rules

1. classify the input shape using `input-contracts.md`
2. pick the smallest recipe that still expresses every required key message
3. if the input declares a target artifact type, restrict the recipe set to that
   type before scoring
4. record both the chosen recipe and the rejected alternatives in the build note

## Recipe Composition

A recipe defines:

- the slide / page / section template sequence
- the allowed component types for each section
- the visual hierarchy rules (heading scale, density, white space)
- the placeholder slots for theme tokens to fill at apply time

Recipes never embed colors, type families, or motion settings. Those come from
the theme layer.

## Anti-Patterns

- mixing two recipes inside one artifact without a structural reason
- forcing a deck recipe onto a one-page handout request
- adding new component slots inside a recipe without a corresponding QC update
- collapsing multiple key messages into one slide without explaining the merge
