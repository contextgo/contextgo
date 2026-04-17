---
name: motion-scene-builder
description: Build, refine, or override individual scenes within a storyboard using shared scene recipes and motion tokens.
compatibility:
  - 'Works best when a storyboard already exists or is being drafted.'
  - 'Useful when a scene needs better composition, pacing, or transition logic without rewriting the whole storyboard.'
---

# Motion Scene Builder

Use this skill when individual scenes need to be authored, refined, or overridden inside an existing storyboard.

Read `../../references/scene-vocabulary.md` before drafting.

## Use when

- A storyboard already exists and one or more scenes need stronger composition.
- A scene must be split, merged, or re-ordered.
- A scene needs a new motion token or transition.
- A scene fails review and must be re-authored without redoing the storyboard.

## Do not use when

- The storyboard itself is missing. Use `motion-storyboard` first.
- The whole render pipeline is failing. Use `motion-render-ops` instead.
- The request is QC and review only. Use `motion-qc`.

## Scene-building failures to avoid

- inventing one-off easing curves instead of using motion tokens
- describing motion only in adjectives such as "smooth" or "snappy"
- overloading a single scene with too many tokens
- breaking caption coverage by extending a scene without extending the caption track
- producing a scene that visually conflicts with its neighbors' motion continuity

## Workflow

### 1. Anchor the scene in the storyboard

Confirm:

- the scene's index
- its intent
- its duration budget in frames
- its transitions in and out

### 2. Choose a recipe or override

Either reference a shared scene recipe or write an explicit composition override.

### 3. Resolve composition

Specify layout regions, asset placement, and text placement.

### 4. Apply motion tokens

Pick named camera, subject, text, and transition tokens. Document the rationale when more than two tokens are combined.

### 5. Re-check neighbors

Verify the scene's start aligns with the previous scene's exit and that motion continuity is honored or intentionally broken.

### 6. Update the storyboard

Persist the scene change and bump the storyboard version when the scene order or intent changes.

## Output format

Return:

### 1. Scene anchor

- index, intent, duration

### 2. Recipe or override

- recipe id, override fields, or full composition spec

### 3. Motion tokens

- camera, subject, text, transition tokens with rationale

### 4. Continuity check

- how the scene aligns with neighbors

### 5. Updated storyboard fragment

- the JSON or pseudo-JSON describing the new scene

### 6. Risks

- timing conflicts, asset gaps, caption coverage gaps

## Use together with

- `motion-storyboard`
- `motion-render-ops`
- `motion-qc`
