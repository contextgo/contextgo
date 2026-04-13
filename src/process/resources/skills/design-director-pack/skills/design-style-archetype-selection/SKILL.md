---
name: design-style-archetype-selection
description: Choose the right visual archetype for a product or page before design work collapses into generic UI output.
compatibility:
  - 'Works best when the product type, target audience, and desired emotional tone are known at least roughly.'
  - 'Useful before drafting a DESIGN.md, art-directing a page, or critiquing whether a current UI feels mismatched.'
---

# Design Style Archetype Selection

Use this skill when the user knows they want a stronger design direction but has not yet translated that into a clear visual system.

Read `../../references/style-archetypes.md` before deciding.

## Use when

- The user says the UI should feel more premium, sharper, calmer, or more distinctive.
- A page or product needs a visual direction before implementation begins.
- The user references outside brands and you need to translate that into a first-party design language.

## Do not use when

- The project already has a stable design direction and only needs implementation detail.
- The task is a narrow spacing or color tweak with no directional ambiguity.

## Archetype-selection failures to avoid

- recommending a style based only on personal taste
- copying a brand name instead of extracting the underlying system logic
- mixing multiple archetypes equally
- choosing a landing-page style that will break the product surface

## Workflow

### 1. Classify the product and the surface

Clarify:

- product category
- trust requirement
- user mindset
- page type

### 2. Name the emotional target

Decide whether the surface should feel primarily:

- precise
- calm
- energetic

### 3. Match the archetype

Select the strongest archetype from the reference set.

If needed, add one secondary influence, but keep one primary.

### 4. Translate the archetype into design consequences

Make the choice concrete through:

- typography character
- palette discipline
- component geometry
- surface density
- motion behavior

### 5. Call out anti-patterns

End with the mistakes most likely to ruin this direction.

## Output format

Return:

### 1. Product and surface read

- product type
- audience
- page or surface type

### 2. Recommended archetype

- primary archetype
- optional secondary influence
- why it fits

### 3. Visual consequences

- type
- color
- components
- spacing
- motion

### 4. Anti-patterns

- what would make the output feel generic or off-brand

## Use together with

- `design-system-distillation`
- `design-landing-page-art-direction`
- `design-product-surface-art-direction`
