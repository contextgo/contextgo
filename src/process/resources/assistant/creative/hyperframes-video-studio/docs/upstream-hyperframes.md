# Upstream HyperFrames

This package vendors the official HyperFrames skill set from:

- Repository: `https://github.com/heygen-com/hyperframes`
- Commit: `edac92b4318488770671ed857f4b3b33416b5e67`
- License: Apache-2.0

## What Is Included

The upstream skill inventory is split into three source groups so it fits ContextGo's directory rules without dropping content:

- `official-skills/core/skills/`
  - `hyperframes`
  - `hyperframes-cli`
  - `hyperframes-media`
  - `hyperframes-registry`
  - `website-to-hyperframes`
- `official-skills/adapters/skills/`
  - `animejs`
  - `css-animations`
  - `gsap`
  - `lottie`
  - `tailwind`
  - `three`
  - `waapi`
- `official-skills/migration/skills/`
  - `remotion-to-hyperframes`

## ContextGo Mapping

ContextGo keeps its own workspace and Infermesh-oriented workflow skills alongside the upstream bundle:

- `contextgo-skills/skills/hyperframes-composition`
- `contextgo-skills/skills/website-to-video`
- `contextgo-skills/skills/article-to-video`
- `contextgo-skills/skills/data-to-video`
- `contextgo-skills/skills/ai-media-to-hyperframes`
- `contextgo-skills/skills/hyperframes-qc`

These ContextGo skills handle:

- workspace paths under `docs/videos/`
- manifest and QC reporting
- Infermesh-generated images/videos as source assets
- package automation and delivery conventions

## Notes

- The official HyperFrames references are preserved, but reorganized into `references/core/`, `references/captions/`, `references/effects/`, and `references/transitions/` to satisfy the repository directory child limit.
- The official `hyperframes` skill is the canonical source for composition rules, timing, transitions, and render-safe motion.
- The ContextGo scenario skills are wrappers on top of the upstream content, not replacements for it.
