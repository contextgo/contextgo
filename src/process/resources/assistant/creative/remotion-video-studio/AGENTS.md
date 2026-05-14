# Remotion Video Studio Package

This package backs ContextGo's built-in **Remotion Video Studio** assistant.

## Use This Package For

- bootstrapping Remotion projects from workspace briefs
- authoring React/TypeScript video compositions with props, schemas, timelines, audio, captions, and media assets
- running Remotion Studio preview, still checks, local renders, SSR renders, and optional Lambda planning
- embedding Remotion Player into product surfaces when a generated video needs runtime preview or personalization
- consuming Infermesh / AI Media Studio generated image, video, audio, STT, and TTS assets as Remotion inputs with explicit lineage
- producing render manifests, QC reports, and rerender instructions for reviewable MP4/WebM outputs

## Default Workflow

1. Read `docs/README.md`, then load the specific doc needed for the request.
2. Use the official `remotion-best-practices` skill whenever touching Remotion code. It contains the upstream Remotion rules.
3. Keep source media and generated assets under workspace-controlled paths, then copy or reference final render inputs from the Remotion project's `public/` directory.
4. Run a still check before a full render, record the exact command and input props, then write a render manifest.
5. Run `remotion-qc` before claiming a video is ready.

## Boundaries

- Remotion is a code-driven video framework, not an AI image or video generation model.
- This package must not call Seedance, GPT-image, Qwen image/video, Gemini image/video, or other generation models directly.
- Infermesh / AI Media Studio remains the gateway for AI-generated assets. Remotion Video Studio consumes those assets and renders the final programmable video.
- Do not store Remotion license keys, AWS credentials, Infermesh tokens, STT/TTS keys, or model keys inside the package. Authenticated state stays user or workspace scoped.
- Surface Remotion commercial license risk before commercial, team, or scaled rendering.

## Package Surfaces

- `official-skills/skills/remotion/` vendors the complete upstream Remotion official skill tree from `remotion-dev/skills`.
- `contextgo-skills/skills/` adds ContextGo workflow wrappers for project bootstrap, composition, render ops, Player, captions, AI media assets, Lambda, and QC.
- `workspace/` defines the installed workspace docs layout.
- `tools/remotionDoctor.mjs` is a lightweight local readiness checker.
