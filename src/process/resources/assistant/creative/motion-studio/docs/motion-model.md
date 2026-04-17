# Motion Model

Motion Studio uses a shared motion vocabulary so storyboards and skills do not invent ad-hoc movement language for every project.

## Why a Motion Model

Without a shared motion model, the same intent gets expressed inconsistently as "fade", "zoom in slowly", "drift", and "soft pan". The renderer cannot resolve those reliably and reviewers cannot give consistent feedback.

## Motion Tokens

The package defines named motion tokens. Each token resolves to a deterministic curve and timing.

### Camera Tokens

- `holdAndPan`: hold then slow horizontal pan
- `slowPushIn`: linear push toward subject
- `parallaxDrift`: layered parallax with slow drift
- `lockedCamera`: no camera movement

### Subject Tokens

- `scaleReveal`: scale from sub-100 to 100 with ease-out
- `slideInFromBaseline`: slide from below the baseline
- `crossDissolve`: opacity blend between two visuals
- `softMaskWipe`: masked wipe with gentle edge

### Text Tokens

- `wordByWordReveal`: animate words sequentially
- `lineByLineReveal`: animate full lines sequentially
- `holdAndDim`: hold then fade caption

### Transition Tokens

- `cleanCut`: hard cut
- `crossFade`: opacity transition
- `motionContinuity`: continue the previous scene's motion across the cut
- `breathPause`: short hold before the next scene starts

## Token Composition

Storyboards may compose tokens, for example combining `slowPushIn` for the camera and `wordByWordReveal` for the caption. The renderer is responsible for ensuring tokens do not conflict.

## Adding New Tokens

When a project repeatedly introduces the same custom curve, promote it to a named token in this document instead of duplicating raw timing values across storyboards.

## Anti-Patterns

- inventing one-off easing curves per scene
- describing motion only in adjectives such as "smooth", "snappy", "dramatic"
- mixing too many tokens in one scene
- using `motionContinuity` across unrelated scenes for visual flair
