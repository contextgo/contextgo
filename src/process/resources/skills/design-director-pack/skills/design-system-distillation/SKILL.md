---
name: design-system-distillation
description: Distill product context and references into a project-level DESIGN.md or design brief with explicit visual rules and anti-patterns.
compatibility:
  - 'Works best when there is at least a rough product goal, audience, and desired visual direction.'
  - 'Useful before implementation or when a project lacks a stable design language.'
---

# Design System Distillation

Use this skill to convert scattered design intent into a reusable, agent-readable design system.

Read `../../references/deliverables.md` before drafting the output.

## Use when

- The user needs a project-level `DESIGN.md`.
- The team has references but no coherent design system.
- Several pages need a shared visual language before implementation.

## Do not use when

- The project already has a stable design system and only needs adaptation.
- The task is a single-page critique with no need for system-level output.

## Distillation failures to avoid

- writing mood-board prose without real rules
- defining colors but not their roles
- naming typography without saying how it creates hierarchy
- giving component advice without stating spacing and layout discipline
- forgetting explicit do-not-do rules

## Workflow

### 1. Lock the design intent

Collect:

- product goal
- audience
- trust and brand requirements
- chosen visual archetype

### 2. Define the system skeleton

Cover at minimum:

- atmosphere
- palette
- typography
- components
- layout
- motion

### 3. Make component behavior explicit

Name how:

- buttons should feel
- cards should behave
- navigation should read
- inputs, tables, or panels should rank visually

### 4. Add guardrails

Spell out:

- what should happen repeatedly
- what must not happen

### 5. Keep it implementable

The output should help a frontend implementer make consistent decisions without inventing a new style on every screen.

## Output format

Return a `DESIGN.md`-style artifact with:

1. visual theme and atmosphere
2. color palette and roles
3. typography rules
4. component styling rules
5. layout principles
6. depth and elevation
7. do and don't rules
8. responsive behavior
9. implementation notes for agents

## Use together with

- `design-style-archetype-selection`
- `design-system-adaptation`
- `design-handoff-brief`
