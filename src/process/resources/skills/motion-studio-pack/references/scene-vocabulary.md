# Scene Vocabulary Reference

Motion Studio scenes use a shared vocabulary so the same intent renders consistently across projects.

## Composition Regions

- `safeCenter`: the central legibility area
- `lowerThird`: caption and lower text
- `upperBand`: brand or title strip
- `edgeBleed`: areas allowed to bleed outside the safe area

## Camera Tokens

- `holdAndPan`
- `slowPushIn`
- `parallaxDrift`
- `lockedCamera`

## Subject Tokens

- `scaleReveal`
- `slideInFromBaseline`
- `crossDissolve`
- `softMaskWipe`

## Text Tokens

- `wordByWordReveal`
- `lineByLineReveal`
- `holdAndDim`

## Transition Tokens

- `cleanCut`
- `crossFade`
- `motionContinuity`
- `breathPause`

## Pacing Hints

- `quickHook`: less than 15 frames opener
- `informational`: medium hold for readable text
- `breathRoom`: extra hold to absorb the previous scene
- `loopReturn`: short pacing to return cleanly to the loop point

## Anti-Patterns

- combining more than two motion tokens per scene without a documented reason
- using `motionContinuity` between unrelated scenes for visual flair
- inventing new tokens inline instead of promoting them to this reference
