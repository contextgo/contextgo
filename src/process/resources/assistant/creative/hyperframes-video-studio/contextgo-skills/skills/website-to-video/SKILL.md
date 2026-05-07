---
name: website-to-video
description: Convert a website, landing page, product page, docs page, or captured URL context into a HyperFrames video with page hierarchy, screenshots, scroll/reveal scenes, captions, CTA, render manifest, and QC.
---

# Website To Video

Use for URL, landing page, product page, documentation, or website walkthrough videos.

## Required Inputs

- URL or captured page context
- target audience
- output channel and aspect ratio
- duration
- CTA or desired viewer action
- whether screenshots should be taken live or supplied as assets

## Workflow

1. Extract page hierarchy: hero, value prop, proof, features, product screenshots, pricing, CTA.
2. Write a concise script or caption track.
3. Use `hyperframes-registry` for scroll, spotlight, screenshot, and CTA scenes.
4. Prepare screenshots/assets with `hyperframes-media`.
5. Build composition with `hyperframes` and `hyperframes-composition`.
6. Preview and render with `hyperframes-cli`.
7. Run `hyperframes-qc`.

## QC Risks

- screenshot crop hides important product details
- text too small on mobile video sizes
- page claim or CTA copied incorrectly
- remote site changes break future rerenders
- brand colors differ from source page
