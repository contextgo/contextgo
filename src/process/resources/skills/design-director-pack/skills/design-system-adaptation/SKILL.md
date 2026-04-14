---
name: design-system-adaptation
description: Translate an outside visual reference into an existing design system without breaking product consistency, token logic, or component contracts.
compatibility:
  - 'Works best when the project already has a design system, component library, or visual constraints that must be preserved.'
  - 'Useful when the user wants influence from a reference but not a brand copy or full redesign.'
---

# Design System Adaptation

Use this skill when the right move is translation, not imitation.

## Use when

- The team already has a design system.
- The user wants inspiration from an outside reference without replacing the current product language.
- A redesign needs to preserve core product consistency.

## Do not use when

- The project has no meaningful visual system yet.
- The user explicitly wants a net-new project-level design system from scratch.

## Adaptation failures to avoid

- treating a reference as a skin pack
- changing every token at once
- copying layouts that do not match the product workflow
- importing marketing-page aesthetics into app surfaces unchanged

## Workflow

### 1. Define the stable core

Lock what should not change:

- component contracts
- accessibility requirements
- brand constraints
- product shell behavior

### 2. Extract the transferable signals

Identify what is actually portable:

- typography attitude
- palette discipline
- density model
- component geometry
- emphasis strategy

### 3. Translate into the local system

Express the adaptation through:

- token adjustments
- component rules
- layout rhythm
- state treatment

### 4. Name the non-transferable parts

Be explicit about which reference traits should stay out.

### 5. Produce a safe change path

Recommend the smallest set of changes that can shift the experience materially without destabilizing the product.

## Output format

Return:

### 1. Existing system constraints

- what must remain stable

### 2. Reference signals worth keeping

- what is transferable

### 3. Translation plan

- tokens
- components
- layout
- motion

### 4. Non-transferable traits

- what to reject

### 5. Safe rollout path

- smallest meaningful implementation sequence

## Use together with

- `design-style-archetype-selection`
- `design-system-distillation`
- `design-ui-critique-and-polish`
