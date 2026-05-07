# HyperFrames Video Studio Package

HyperFrames Video Studio packages deterministic HTML-to-video workflows for ContextGo agents. It turns websites, articles, changelogs, reports, tables, generated images, generated video snippets, subtitles, and brand systems into reproducible MP4/WebM artifacts.

This package complements AI Media Studio. AI Media Studio generates media through Infermesh. HyperFrames Video Studio composes and renders final videos with exact text, layout, timing, charts, subtitles, and brand wrappers.

## Included Skills

- `hyperframes-composition`: author scene structure, timelines, dimensions, and animations.
- `hyperframes-cli`: initialize, preview, render, package, and diagnose HyperFrames projects.
- `hyperframes-media`: manage assets, fonts, audio, subtitles, generated media inputs, and file references.
- `hyperframes-registry`: use and extend reusable scenes, adapters, and templates.
- `website-to-video`: convert URLs or page captures into short product or explainer videos.
- `article-to-video`: convert docs, changelogs, blogs, and reports into narrated or captioned video scripts.
- `data-to-video`: convert CSV/JSON/tables into animated chart videos.
- `ai-media-to-hyperframes`: compose Infermesh-generated images/videos into a final HyperFrames render.
- `hyperframes-qc`: validate render outputs, manifests, dimensions, duration, subtitles, assets, and rerender readiness.

## Install Surfaces

- Skills install into `.contextgo/skills` and runtime-native directories as projections.
- Commands install through `.contextgo/commands.json`.
- Schedule templates install through `.contextgo/schedules.json` as disabled recurring draft/QC flows.
- Requirements install into `.contextgo/requirements/` without secrets.
