# Render Pipeline

## Phases

1. Environment check: Node.js 22+, FFmpeg, HyperFrames CLI, optional Docker.
2. Brief normalization: duration, dimensions, frame rate, channels, source URLs/files, audience, and required text.
3. Composition design: scenes, timeline, transitions, typography, data bindings, media references.
4. Asset preparation: images, video clips, audio, subtitles, fonts, and generated media inputs.
5. Preview: run the HyperFrames preview command and inspect layout/timing.
6. Render: produce MP4/WebM output.
7. Manifest: write source, command, dimensions, duration, output, and dependencies.
8. QC: verify file, duration, dimensions, subtitles, assets, and visual stability.

## Render Manifest

Minimum shape:

```json
{
  "schemaVersion": "hyperframes-render.v1",
  "projectId": "launch-video",
  "projectPath": "docs/videos/projects/launch-video",
  "outputPath": "docs/videos/renders/launch-video.mp4",
  "command": "npx hyperframes render ...",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationSeconds": 30,
  "assets": [],
  "createdAt": "2026-05-07T00:00:00.000Z",
  "qc": {
    "status": "pending"
  }
}
```

## Failure Handling

- Missing Node/FFmpeg: stop and report setup steps.
- Missing asset: block render until path is corrected.
- Broken preview: fix layout and console errors before render.
- Render timeout: keep manifest and logs, reduce duration or use Docker/CI profile if needed.
- QC failure: keep output but mark rerun required.
