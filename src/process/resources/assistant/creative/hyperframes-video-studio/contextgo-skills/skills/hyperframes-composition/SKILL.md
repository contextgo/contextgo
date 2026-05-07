---
name: hyperframes-composition
description: Author deterministic HyperFrames HTML/CSS/JS video compositions with scenes, dimensions, timelines, animations, subtitles, titles, transitions, charts, and brand-controlled layouts. Use for local or CI HTML-to-video rendering, not for prompt-to-video model calls.
---

# HyperFrames Composition

Use this skill when creating or editing the source composition for a deterministic rendered video.

## Boundary

- Write HTML/CSS/JS composition source for HyperFrames.
- Do not call AI image/video generation APIs.
- Use `ai-media-to-hyperframes` when generated assets are inputs.
- Keep exact visible text in source files so rerenders are reproducible.

## Composition Plan

Before coding, decide:

- output format: width, height, aspect ratio, fps, duration
- channel: short vertical, square social, landscape explainer, internal report, product demo
- scenes: id, duration, visual goal, text, media, data, animation
- transitions: cut, fade, slide, zoom, wipe, scroll, chart morph
- typography and safe margins
- required subtitles or lower thirds
- assets and data files

## Authoring Rules

- Use semantic scene ids and stable asset paths.
- Keep animation timing explicit; avoid hidden timing based on real wall-clock behavior.
- Prefer CSS/GSAP/WAAPI timing that can be reasoned about frame by frame.
- Keep text legible on the target viewport; do not rely on viewport-scaled font tricks.
- Do not embed remote media when local assets can be stored under `docs/videos/assets/`.
- Keep scene data in structured JSON or JS objects when the video is data-driven.

## Output

Return:

- project path
- composition files changed
- scene timeline
- preview command
- render command
- assets required
- QC risks
