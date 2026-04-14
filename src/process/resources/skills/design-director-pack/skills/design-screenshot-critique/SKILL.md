---
name: design-screenshot-critique
description: Critique screenshots and mockups with a first-scan read, prioritized visual findings, system causes, and concrete redesign moves.
compatibility:
  - 'Works best when the user provides screenshots, mockups, or a screen recording still.'
  - 'Useful before polish passes, design review, or implementation correction.'
---

# Design Screenshot Critique

Use this skill when the user wants a design readout from screenshots rather than from code or abstract descriptions.

Read `../../references/deliverables.md` and `../../references/screenshot-critique-rubric.md` before drafting the critique.

## Use when

- The user provides screenshots and asks what is wrong.
- A surface needs a fast but rigorous design review before more implementation.
- The team wants screenshot-level critique that still connects to system rules.

## Do not use when

- There is no visible surface to assess.
- The task is to design from scratch without a current artifact.

## Critique failures to avoid

- treating the screenshot like a mood board instead of a product surface
- listing small polish nits before naming broken hierarchy
- ignoring what the first five-second scan tells the user
- recommending changes that would obviously break the current system

## Workflow

### 1. Capture the first-scan read

State:

- what this screen appears to do
- what element wins attention first
- whether the primary action is obvious

### 2. Review the hierarchy and scan path

Look for:

- focal point clarity
- information chunking
- action ranking
- density fit for the screen's job

### 3. Explain the system causes

Name root causes such as:

- weak surface hierarchy
- token drift
- component inconsistency
- mixed page lenses
- unclear state design

### 4. Recommend the smallest high-value redesign moves

Prioritize moves that improve the whole surface quickly.

### 5. Preserve the right strengths

Explicitly name what should stay.

## Output format

Return:

### 1. Screenshot read

- screen purpose
- first-scan attention pattern

### 2. Highest-severity issues

- ordered by severity

### 3. System causes

- why the surface looks or feels this way

### 4. Redesign moves

- smallest high-value changes first

### 5. What to preserve

- stable strengths worth carrying forward

## Use together with

- `design-ui-critique-and-polish`
- `design-landing-page-art-direction`
- `design-product-surface-art-direction`
- `design-handoff-brief`
