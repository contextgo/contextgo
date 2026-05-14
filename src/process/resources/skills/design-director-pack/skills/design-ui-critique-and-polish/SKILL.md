---
name: design-ui-critique-and-polish
description: Critique an existing UI with prioritized findings, system-level causes, and concrete polish moves that preserve implementation realism.
compatibility:
  - 'Works best when a current UI, screenshot set, coded surface, or page description already exists.'
  - 'Useful for redesign, polish passes, and design review before implementation or release.'
---

# Design UI Critique and Polish

Use this skill when the right answer is a sharp design review, not a vague list of improvements.

Read `../../references/deliverables.md` before drafting the critique.

## Use when

- The user asks what is wrong with the current UI.
- A surface feels generic, messy, or inconsistent.
- The team needs a prioritized polish plan before more implementation.

## Do not use when

- There is no current UI or surface to critique.
- The task is only to choose a style direction from scratch.

## Critique failures to avoid

- giving only compliments or only taste-based reactions
- listing symptoms without naming the system cause
- suggesting a redesign that ignores the current component system
- hiding severity by flattening all issues into one list

## Workflow

### 1. Identify the surface job

State:

- what the UI is trying to do
- what users need to see or do first

### 2. Find the highest-severity design failures

Look first for:

- broken hierarchy
- bad spacing rhythm
- weak contrast or surface logic
- inconsistent component language
- unclear action ranking

### 3. Explain the system cause

Do not stop at "too busy" or "needs polish."

Name:

- token inconsistency
- density mismatch
- component misuse
- landing-versus-product lens confusion
- missing design rules

### 4. Propose the smallest high-value fixes first

Prioritize changes that improve the whole system, not just one screenshot.

### 5. Preserve what already works

Say explicitly what should remain stable.

## Output format

Return:

### 1. Surface read

- what the UI is trying to do

### 2. Findings

- ordered by severity

### 3. System causes

- why the issues are happening

### 4. Polish plan

- concrete fixes
- what to do first

### 5. What to preserve

- stable strengths worth keeping

## Use together with

- `design-system-adaptation`
- `design-product-surface-art-direction`
- `design-handoff-brief`
