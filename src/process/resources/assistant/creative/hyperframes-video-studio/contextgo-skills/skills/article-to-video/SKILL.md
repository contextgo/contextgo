---
name: article-to-video
description: Convert articles, blog posts, changelogs, docs, reports, release notes, and briefs into HyperFrames explainer or social videos with scripts, captions, scenes, citations, renders, and QC.
---

# Article To Video

Use when the source is prose or a document rather than an existing visual page.

## Workflow

1. Distill the source into hook, 3-5 beats, evidence, and CTA.
2. Decide format: narrated explainer, caption-only short, changelog recap, executive summary, or tutorial.
3. Write scenes with exact visible text and optional voiceover/subtitle script.
4. Use `hyperframes` for official scene layout and timing rules.
5. Use `hyperframes-composition` for workspace paths, manifests, and delivery conventions.
6. Use `hyperframes-media` for screenshots, diagrams, and source assets.
7. Render with `hyperframes-cli`.
8. Run `hyperframes-qc` for factual alignment, subtitle readability, and timing.

## Rules

- Preserve key facts and dates from the source.
- Do not invent metrics or quotes.
- Keep citations/source notes in `docs/videos/briefs/`.
- For long sources, make a short video plan first instead of trying to cover everything.

## Output

Return script, scene list, project path, render output path, manifest path, and QC verdict.
