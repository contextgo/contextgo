---
name: design-component-visual-spec
description: Write component-level visual specifications with anatomy, variants, tokens, states, composition rules, and acceptance checks.
compatibility:
  - 'Works best when the page direction or design system is already mostly clear.'
  - 'Useful for frontend handoff, component-library updates, or precision redesign work.'
---

# Design Component Visual Spec

Use this skill when page-level direction is not enough and the team needs component-by-component implementation guidance.

Read `../../references/component-spec-template.md` and `../../references/deliverables.md` before drafting.

## Use when

- The user asks for a component spec.
- A frontend implementer needs exact component guidance.
- The redesign depends on buttons, tabs, cards, tables, inputs, dialogs, or panels behaving consistently.

## Do not use when

- The visual direction is still unresolved.
- The user only needs a broad page critique or style recommendation.

## Spec failures to avoid

- describing a component with adjectives instead of rules
- forgetting states, anatomy, or spacing
- writing a spec that ignores nearby composition and layout behavior
- giving token suggestions without saying what they control

## Workflow

### 1. Define the component's job

Clarify:

- what the component must help the user do
- what context it appears in
- what rank it should have visually

### 2. Define the anatomy and variants

Specify:

- parts
- size options
- variants
- density modes if relevant

### 3. Write the visual rules

Cover:

- surfaces and color roles
- typography
- spacing and alignment
- borders, radius, and shadow
- icon treatment

### 4. Cover interactive and edge states

Include:

- default
- hover
- active
- focus
- disabled
- loading
- selected
- error or warning if relevant

### 5. Add composition rules and acceptance checks

Make it easy for implementation to stay consistent across screens.

## Output format

Return a component visual spec with:

1. component role
2. variants and sizes
3. anatomy
4. visual rules
5. state rules
6. composition rules
7. guardrails
8. acceptance checks

## Use together with

- `design-system-distillation`
- `design-system-adaptation`
- `design-handoff-brief`
