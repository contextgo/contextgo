---
name: hyperframes-cli
description: Initialize, preview, render, package, diagnose, and resume HyperFrames video projects in a ContextGo workspace, including Node.js 22+, FFmpeg, CLI, Docker checks, render manifests, and output placement.
---

# HyperFrames CLI

Use this skill for environment checks and command execution around HyperFrames projects.

## Environment Check

Before first render, verify:

- Node.js major version is at least 22.
- FFmpeg is available.
- HyperFrames CLI can run through `npx`, `npm exec`, `bunx`, or a project-local script.
- Optional Docker is available when reproducible render mode is requested.

When shell execution is available, use the bundled doctor script:

```bash
node path/to/hyperframes-cli/scripts/hyperframesDoctor.mjs
```

## Workflow

1. Pick or create a project folder under `docs/videos/projects/<project-id>/`.
2. Run environment checks.
3. Initialize project source if missing.
4. Preview before rendering.
5. Render MP4/WebM into `docs/videos/renders/`.
6. Write a render manifest under `docs/videos/manifests/`.
7. Run `hyperframes-qc`.

## Command Policy

- Prefer project-local package scripts when present.
- Use `npx`/`bunx` only when a project has not pinned HyperFrames yet.
- Capture exact render command in the manifest.
- Do not overwrite a previous render without changing the output filename or version suffix.
- If the CLI command is unknown in the current HyperFrames version, inspect project docs or package scripts instead of guessing flags.

## Manifest Fields

Record project id, project path, command, dimensions, fps, duration, output path, source files, assets, generated-at timestamp, and QC status.

## Failure Rules

- Missing Node/FFmpeg blocks render.
- Missing CLI blocks render but does not block composition planning.
- Preview errors must be fixed before final render.
- Render timeout should keep logs and a manifest entry with `status: "timeout"`.
