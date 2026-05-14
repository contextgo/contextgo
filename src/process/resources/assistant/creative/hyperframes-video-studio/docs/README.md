# HyperFrames Video Studio Package

HyperFrames Video Studio packages deterministic HTML-to-video workflows for ContextGo agents. It turns websites, articles, changelogs, reports, tables, generated images, generated video snippets, subtitles, and brand systems into reproducible MP4/WebM artifacts.

This package complements AI Media Studio. AI Media Studio generates media through Infermesh. HyperFrames Video Studio composes and renders final videos with exact text, layout, timing, charts, subtitles, and brand wrappers.

## Included Skills

- Official upstream skills from HyperFrames:
  - `hyperframes`: author HTML compositions, captions, voiceovers, audio-reactive visuals, transitions, and render-safe timing.
  - `hyperframes-cli`: initialize, lint, inspect, preview, render, diagnose, and upgrade HyperFrames projects.
  - `hyperframes-media`: run TTS, transcribe audio/video, and remove backgrounds for composition assets.
  - `hyperframes-registry`: install and wire reusable HyperFrames blocks and components.
  - `website-to-hyperframes`: run the official seven-step website capture-to-video pipeline.
  - `gsap`, `animejs`, `css-animations`, `lottie`, `tailwind`, `three`, and `waapi`: adapter contracts for deterministic frame seeking.
  - `remotion-to-hyperframes`: translate explicit Remotion migration requests into HyperFrames.
- ContextGo workflow skills:
  - `hyperframes-composition`: place projects, manifests, assets, and render outputs in the workspace.
  - `website-to-video`: convert URLs or page captures into ContextGo video briefs and deliverables.
- `article-to-video`: convert docs, changelogs, blogs, and reports into narrated or captioned video scripts.
- `data-to-video`: convert CSV/JSON/tables into animated chart videos.
- `ai-media-to-hyperframes`: compose Infermesh-generated images/videos into a final HyperFrames render.
- `hyperframes-qc`: validate render outputs, manifests, dimensions, duration, subtitles, assets, and rerender readiness.

See `upstream-hyperframes.md` for the vendored upstream commit, source layout, and package mapping.

## Install Surfaces

- Skills install into `.contextgo/skills` and runtime-native directories as projections.
- Commands install through `.contextgo/commands.json`.
- Schedule templates install through `.contextgo/schedules.json` as disabled recurring draft/QC flows.
- Requirements install into `.contextgo/requirements/` without secrets.
