# HyperFrames Video Studio

HyperFrames Video Studio is the ContextGo Agent Package for deterministic HTML-to-video production.

## Upstream Basis

- This package vendors the official HyperFrames skill set from `https://github.com/heygen-com/hyperframes` at commit `edac92b4318488770671ed857f4b3b33416b5e67`.
- Official HyperFrames skills live under `official-skills/` and keep their Apache-2.0 license in `official-skills/LICENSE`.
- ContextGo-specific scenario skills live under `contextgo-skills/` and layer workspace, Infermesh asset handoff, QC, and package automation on top of the official skills.
- See `docs/upstream-hyperframes.md` for the official inventory and ContextGo mapping.

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
2. Use the official `hyperframes` skill for composition rules, timing, references, and render-safe animation.
3. Use `hyperframes-composition` for ContextGo workspace placement, manifests, and delivery conventions.
4. Use `hyperframes-media` to prepare assets, subtitles, fonts, and audio.
5. Use adapter skills such as `gsap`, `tailwind`, `three`, `lottie`, `waapi`, `animejs`, or `css-animations` when the composition uses those runtimes.
6. Use `hyperframes-cli` to initialize, inspect, preview, render, and troubleshoot.
7. Use `hyperframes-qc` before delivery.

## Delivery Standard

Every completed request should report:

- project path
- render command
- output file path
- render manifest path
- QC report path and verdict
- unresolved environment, font, timing, or asset risks
