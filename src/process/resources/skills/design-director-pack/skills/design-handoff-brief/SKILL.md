---
name: design-handoff-brief
description: Convert a chosen design direction into a frontend-ready handoff with layout rules, tokens, components, state behavior, and acceptance checks.
compatibility:
  - 'Works best after the design direction is already reasonably clear.'
  - 'Useful when a frontend agent or engineer needs precise guidance instead of aesthetic adjectives.'
---

# Design Handoff Brief

Use this skill when the design thinking is done and the implementation brief now matters.

Read `../../references/deliverables.md` before drafting the handoff.

## Use when

- The team is ready to implement a new page or redesign.
- A frontend agent needs a precise design brief.
- Design critique or art direction already exists and must be turned into execution guidance.

## Do not use when

- The visual direction is still unresolved.
- The task is a broad critique with no implementation target yet.

## Handoff failures to avoid

- giving high-level adjectives instead of layout rules
- describing visuals without component priorities
- forgetting states, responsive behavior, or motion constraints
- handing off a direction that cannot be checked after implementation

## Workflow

### 1. Lock the implementation target

Clarify:

- which page or surface
- which user goal
- which visual archetype or system rules apply

### 2. Describe the structure

Specify:

- page sections or shell regions
- order
- hierarchy
- responsive collapse behavior

### 3. Define the visual rules

Include:

- tokens or palette logic
- typography hierarchy
- component behavior
- spacing discipline
- motion rules

### 4. Cover important states

Explicitly mention:

- loading
- empty
- error
- success

### 5. End with acceptance checks

Give a short list of things that must be true in the implemented result.

## Output format

Return:

### 1. Target and goal

- page
- audience
- user objective

### 2. Layout structure

- sections or shell regions
- ordering
- responsive behavior

### 3. Visual rules

- type
- color
- surfaces
- component behavior
- motion

### 4. States

- loading
- empty
- error
- success

### 5. Acceptance checks

- what must be true after implementation

## Use together with

- `design-system-distillation`
- `design-landing-page-art-direction`
- `design-product-surface-art-direction`
- `design-ui-critique-and-polish`
