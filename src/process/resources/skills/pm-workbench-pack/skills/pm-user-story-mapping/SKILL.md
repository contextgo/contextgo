---
name: pm-user-story-mapping
description: Create a story map that lays out user activities, steps, tasks, and release slices around a real journey.
compatibility:
  - 'Works best when the target segment, persona, and end-to-end user goal are already reasonably clear.'
  - 'Useful after strategy or discovery when the team needs to translate a workflow into MVP and follow-on release slices.'
---

# PM User Story Mapping

Use this skill to organize product scope around the user's journey instead of around internal components or a random backlog.

## What story mapping is for

Story mapping helps teams see:

- the user journey from left to right
- what must happen for the user to succeed
- what belongs in MVP versus later releases

It is a planning artifact, not just a workshop exercise.

## Use when

- A feature or product flow spans multiple user steps.
- Product, design, and engineering need a shared picture of the workflow.
- The team needs to define release slices without losing the end-to-end user story.

## Do not use when

- The request is too small to justify a map.
- The team still does not understand the user or the job to be done.
- You only need a flat backlog sort.

## Anti-patterns

- mapping screens instead of user actions
- turning activities into feature names
- making the map so detailed that it becomes a task tracker
- drawing release slices before the backbone is credible

## Story map model

### Horizontal axis: the narrative backbone

From left to right:

- activities
- steps
- tasks

This tells the user's story over time.

### Vertical axis: priority and release slicing

From top to bottom:

- essential tasks
- important follow-ons
- later improvements

This defines scope without losing the full journey.

## Workflow

### Step 1: Set the context

State:

- segment
- persona
- user goal or job to be done

Use a single clear narrative:

`A new workspace admin sets up the product, invites collaborators, completes the first successful workflow, and confirms the setup is working.`

If the narrative requires several different users with different goals, split the map instead of forcing one giant story.

### Step 2: Define the backbone activities

List 3-7 high-level user activities in sequence.

Examples:

- discover
- evaluate
- set up
- configure
- complete first value
- monitor results

These must be user behaviors, not product modules.

### Step 3: Break activities into steps

For each activity, write the concrete steps the user takes.

Checklist:

- observable
- sequential
- user-centered
- narrow enough to reason about scope

### Step 4: Break steps into tasks

Add the smaller tasks or system support needed under each step.

Keep them crisp. If tasks read like engineering subtasks, you went too deep.

### Step 5: Slice releases

Draw the first release slice across the map.

A good MVP slice:

- preserves the end-to-end journey
- includes only what is needed for the user to succeed
- avoids leaving key journey gaps

Later slices should improve depth, flexibility, and scale, not repair a broken core flow.

### Step 6: Check for journey gaps

Look for:

- broken handoffs
- missing trust or confirmation moments
- unrecoverable failure states
- tasks that only serve internal logic, not the user outcome

## Output format

Return:

### 1. Context

- segment
- persona
- user narrative

### 2. Backbone activities

- activity list in sequence

### 3. Story map

- each activity
- its steps
- tasks under each step

### 4. Release slices

- MVP / release 1
- release 2
- later

### 5. Gaps and recommendations

- missing steps
- risky assumptions
- places where the MVP slice may fail the journey

## Quality bar

The story map is useful only if:

- the backbone reads like a real user story
- activities are not feature labels
- the MVP slice still forms a complete user journey
- later slices enhance rather than rescue the first release

## Use together with

- `pm-prd-development` when the map needs to feed scope and requirements
- `pm-roadmap-planning` when release slices must align with broader roadmap sequencing
