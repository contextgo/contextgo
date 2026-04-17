---
name: motion-storyboard
description: Turn a motion brief into a validated storyboard with scenes, targets, audio, captions, and a cover frame before render.
compatibility:
  - 'Works best when the goal, audience, and at least one channel target are roughly known.'
  - 'Useful before any render call, even when the brief is short.'
---

# Motion Storyboard

Use this skill when the request is to plan a video, motion poster, product cut, or social cutdown and there is no validated storyboard yet.

Read `../../references/storyboard-shape.md` and `../../references/scene-vocabulary.md` before drafting.

## Use when

- The user wants a new video, motion poster, demo cut, or social cutdown.
- There is a brief, but no scene-level structure yet.
- A previous render needs to be re-planned because scene structure changed.

## Do not use when

- The task is to render an existing validated storyboard. Use `motion-render-ops` instead.
- The task is a static page, brand KV, or document layout. Route to a static visual package.
- The task is design judgement or visual direction shaping. Route to `design-director`.

## Storyboard failures to avoid

- starting from prompt-only output instead of a scene plan
- inventing motion adjectives instead of named motion tokens
- skipping the target list and locking the storyboard to a single aspect ratio
- forgetting captions when the storyboard targets a social channel
- choosing a cover frame that does not communicate the goal in under one second

## Workflow

### 1. Lock the goal

Clarify:

- what this video must accomplish
- who is watching
- how long it should be
- which channels and aspect ratios it must support

### 2. Plan the targets

For each channel, declare aspect, duration, caption requirement, and cover frame intent.

### 3. Draft the scene list

Use named scene recipes when possible. For each scene, declare:

- intent
- duration in frames
- composition
- transitions in and out
- motion tokens
- referenced assets

### 4. Plan audio and captions

Declare voiceover, music, ambient, and caption tracks. Make timing, language, and safe-area expectations explicit.

### 5. Validate against the storyboard contract

Confirm every required field is present and every reference resolves.

### 6. Persist the storyboard

Write the storyboard JSON, the script, and any reviewer notes into the workspace storyboards directory.

## Output format

Return:

### 1. Goal and audience

- one short paragraph

### 2. Target list

- aspect, duration, channel, caption requirement per target

### 3. Scene list

- ordered scenes with intent, duration, composition summary, motion tokens, transitions

### 4. Audio and captions plan

- voiceover, music, ambient, caption tracks

### 5. Cover frame choice

- which scene or timestamp serves as the cover and why

### 6. Open risks

- missing assets, unresolved timing, language coverage

## Use together with

- `motion-scene-builder`
- `motion-render-ops`
- `motion-qc`
