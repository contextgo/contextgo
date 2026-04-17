---
name: motion-render-ops
description: Render a validated storyboard into reproducible video output with pre-render checks, render configs, and render manifests.
compatibility:
  - 'Works best when a validated storyboard already exists.'
  - 'Useful when planning multi-target renders, multi-channel cutdowns, or rerendering with updated assets.'
---

# Motion Render Ops

Use this skill to drive the actual render: resolving the storyboard, expanding targets, running pre-render checks, executing the render, and persisting manifests.

Read `../../references/render-config.md` and `../../references/channel-targets.md` before running a render.

## Use when

- A validated storyboard is ready to render.
- A previous render needs to be reproduced or extended to new channels.
- An asset or recipe version changed and the artifact must be regenerated.

## Do not use when

- The storyboard is not validated. Use `motion-storyboard` first.
- The failure is a QC issue, not a render issue. Use `motion-qc`.
- The brief asks to invent new scenes during render time. That is a guardrail violation.

## Render-ops failures to avoid

- starting render without resolving asset references
- skipping the pre-render hook
- running a render without a stored seed for any random behavior
- failing to record render config alongside the output
- silently truncating audio or captions when scene length conflicts with audio length

## Workflow

### 1. Resolve the storyboard

Validate against the storyboard contract. Reject invalid storyboards.

### 2. Expand targets

Build a render config per target with aspect, duration, caption layout, cover frame, codec, and bitrate.

### 3. Run pre-render checks

Run the pre-render hook or its in-skill equivalent: duration, asset presence, caption coverage, cover frame, export spec.

### 4. Execute the render

Use the configured code-driven motion runtime, default `remotion`. Persist the render config alongside the output.

### 5. Generate post-render artifacts

Produce a contact sheet and a render manifest with scene-level metadata and asset references.

### 6. Surface failures with rerun guidance

When a scene fails, persist scene-level diagnostics and a rerun suggestion.

## Output format

Return:

### 1. Storyboard summary

- id, version, target count, scene count

### 2. Render plan

- per-target render config summary

### 3. Pre-render check result

- pass list and any blocking failures

### 4. Render result

- per-target output path, status, duration

### 5. Post-render artifacts

- contact sheet path and manifest path per target

### 6. Failure follow-up

- failed scenes, suggested rerun, asset or config gaps

## Use together with

- `motion-storyboard`
- `motion-scene-builder`
- `motion-qc`
