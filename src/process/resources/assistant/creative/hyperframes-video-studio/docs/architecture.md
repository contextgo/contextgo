# Architecture

HyperFrames Video Studio is a local/CI render package.

## Runtime Model

1. The agent creates an HTML/CSS/JS composition.
2. HyperFrames previews the composition in a browser-like environment.
3. HyperFrames captures frames deterministically.
4. FFmpeg encodes frames into MP4/WebM.
5. ContextGo stores source, render manifest, output, and QC report in the workspace.

## Boundaries

- HyperFrames is tool/runtime automation, not a model provider.
- HyperFrames is not a Context Connector.
- Generated image/video assets should come from AI Media Studio or user-provided files.
- Project state belongs in `docs/videos/projects/`; reusable workspace state can be referenced from `.contextgo/` but should not store rendered secrets or keys.

## Artifacts

- `brief.md`: goal, audience, runtime, channel, size, duration, and source references.
- `project/`: HyperFrames composition source.
- `manifest.json`: render command, dimensions, duration, output file, assets, and source hash/notes.
- `render.mp4` or `render.webm`: final output.
- `qc.md`: checks and verdict.
