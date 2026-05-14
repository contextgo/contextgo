---
name: remotion-captions
description: Manage Remotion caption workflows including transcription, SRT import, display timing, TikTok-style captions, and word highlighting.
---

# Remotion Captions

Use this skill for subtitles, captions, transcription outputs, SRT/VTT/JSON inputs, and caption rendering.

## Workflow

1. Identify the caption source: user-provided file, transcript, STT output, or generated voiceover timing.
2. Use Infermesh / AI Media Studio for STT if generation is needed; do not call STT providers directly from this package.
3. Load the official caption rules from `remotion-best-practices`.
4. Normalize timing and text before rendering.
5. Check captions in representative stills and full playback during QC.

## QC Focus

- speech-to-text accuracy
- line breaks and safe areas
- word highlighting timing
- contrast and legibility
- no captions covering product-critical visuals
