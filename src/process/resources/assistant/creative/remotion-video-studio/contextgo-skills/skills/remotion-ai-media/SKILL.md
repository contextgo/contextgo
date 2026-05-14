---
name: remotion-ai-media
description: Consume Infermesh / AI Media Studio generated image, video, audio, TTS, and STT assets in Remotion while preserving asset lineage.
---

# Remotion AI Media

Use this skill when Remotion needs generated images, videos, voiceover, music, sound effects, or captions.

## Boundary

Remotion Video Studio does not call generation models directly. Route generation through the user's configured Infermesh / AI Media Studio access, then consume the resulting files.

## Asset Ledger

For every generated asset, record:

- asset id and file path
- Infermesh task id or ContextGo generation reference
- model/provider id when available
- prompt or source brief reference
- generation timestamp
- transformations applied before render
- final `public/` path used by Remotion
- license or usage caveat

Store ledgers under `docs/videos/remotion/assets/` and link them from render manifests.
