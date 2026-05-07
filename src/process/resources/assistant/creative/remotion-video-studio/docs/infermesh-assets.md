# Infermesh Assets

Remotion Video Studio does not call image, video, audio, STT, or TTS models directly. Use Infermesh / AI Media Studio as the model gateway, then consume the generated assets in Remotion.

## Intake Rules

- Copy or reference generated assets into the Remotion project's `public/` directory before rendering.
- Preserve original file names when practical; otherwise record the rename.
- Store a workspace asset ledger under `docs/videos/remotion/assets/`.
- Record Infermesh task id, model id, prompt or brief reference, generation time, source file, transformed file, and license/usage notes.
- Do not embed user keys or provider tokens in Remotion source code.

## Typical Flow

1. Generate or retrieve assets through the user's configured Infermesh access.
2. Normalize assets for Remotion: dimensions, codec, alpha, audio sample rate, and captions.
3. Copy render-time assets into `public/`.
4. Reference them with Remotion static file helpers.
5. Add lineage rows to the render manifest before QC.
