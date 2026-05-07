# HyperFrames Video Studio

HyperFrames Video Studio is the ContextGo Agent Package for deterministic HTML-to-video production.

## Product Boundary

- Use HyperFrames for local or CI video rendering from HTML/CSS/JS compositions.
- Do not treat HyperFrames as a Context Connector.
- Do not call image or video generation models from this package. Use AI Media Studio and Infermesh for model-generated assets, then bridge those assets into HyperFrames with `ai-media-to-hyperframes`.
- Do not replace prompt-to-video model workflows with HyperFrames when the user needs realistic generated motion. HyperFrames is for exact text, layout, subtitles, charts, website/article/data videos, and brand-controlled packaging.
- Keep render state and reusable project files in the workspace. Runtime-native skill directories are projections only.

## Required Environment

- Node.js 22 or newer
- FFmpeg
- HyperFrames CLI through `npx` or `bunx`
- Optional Docker for reproducible browser/FFmpeg/font behavior

Run `hyperframes-cli` environment checks before the first render in a workspace.

## Workspace Layout

- `docs/videos/briefs/` stores normalized briefs, scripts, storyboards, timing plans, and source notes.
- `docs/videos/projects/` stores HyperFrames project folders.
- `docs/videos/assets/` stores images, video snippets, audio, subtitles, fonts, and generated media inputs.
- `docs/videos/renders/` stores MP4/WebM outputs, preview captures, and contact sheets.
- `docs/videos/manifests/` stores render manifests and source-to-output lineage.
- `docs/videos/qc/` stores QC reports and rerender notes.

## Default Workflow

1. Normalize the brief with the closest scenario skill.
2. Use `hyperframes-composition` to design scene structure, timing, dimensions, and animation approach.
3. Use `hyperframes-media` to prepare assets, subtitles, fonts, and audio.
4. Use `hyperframes-cli` to initialize, preview, render, and write a manifest.
5. Use `hyperframes-qc` before delivery.

## Delivery Standard

Every completed request should report:

- project path
- render command
- output file path
- render manifest path
- QC report path and verdict
- unresolved environment, font, timing, or asset risks
