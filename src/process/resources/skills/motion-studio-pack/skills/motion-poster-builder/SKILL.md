---
name: motion-poster-builder
description: Build a motion poster with a single composition, subtle motion, loop-friendly pacing, and channel-aware framing.
compatibility:
  - 'Works best when the brief is brand-led, identity-led, or campaign-led with a short loopable output.'
  - 'Useful when the request is a static-looking visual that still needs subtle motion to read on social or display surfaces.'
---

# Motion Poster Builder

Use this skill when the request is a motion poster: a single composition with subtle motion, short duration, and loop-friendly pacing.

Read `../../references/scene-vocabulary.md` and `../../references/channel-targets.md` before drafting.

## Use when

- The brief is for a brand, identity, or event poster that benefits from subtle motion.
- The output is short and loopable.
- The output must work across vertical, square, or horizontal display surfaces.

## Do not use when

- The brief requires multi-scene narrative. Use `motion-storyboard` and `motion-scene-builder`.
- The brief is fully static. Route to a static visual package.
- The brief is a product demo, explainer, or social cutdown. Use the storyboard skills instead.

## Motion poster failures to avoid

- moving everything in the composition
- using narrative pacing in a poster context
- losing legibility because of motion
- ignoring channel safe areas
- choosing motion that does not loop cleanly

## Workflow

### 1. Lock the identity intent

Clarify:

- what brand or identity this poster represents
- the primary headline
- the desired emotional read

### 2. Plan the composition

Specify the focal point, supporting elements, typography hierarchy, and color logic.

### 3. Choose subtle motion

Pick at most two motion tokens that enhance the composition without distracting.

### 4. Plan the loop

Confirm the motion returns to the starting frame and that the loop point is invisible.

### 5. Plan multi-format framing

Confirm the composition works in vertical, square, and horizontal targets, with safe areas respected.

### 6. Persist the storyboard

Write a single-scene storyboard with the chosen targets, motion tokens, and cover frame.

## Output format

Return:

### 1. Identity intent

- brand, headline, emotional read

### 2. Composition

- focal point, supporting elements, typography, color

### 3. Motion plan

- selected tokens with rationale

### 4. Loop plan

- loop point and how seamlessness is achieved

### 5. Multi-format framing

- target list with safe-area notes

### 6. Storyboard fragment

- the single-scene storyboard JSON or pseudo-JSON

## Use together with

- `motion-render-ops`
- `motion-qc`
