---
name: remotion-qc
description: Validate Remotion outputs for render integrity, dimensions, fps, duration, audio, captions, visible text, asset lineage, licensing, and rerender instructions.
---

# Remotion QC

Use this skill before declaring a Remotion render ready.

## Checklist

- Output file exists and has the expected container.
- Dimensions, fps, codec, and duration match the brief.
- Representative still frames are not blank and match the storyboard.
- All exact visible text from the composition plan appears correctly.
- Audio, voiceover, captions, and subtitles are in sync.
- Infermesh / AI Media Studio asset lineage is complete.
- Remotion license status and third-party asset rights are recorded.
- The rerender command and input props are reproducible.

## Report

Return:

- verdict: `pass`, `warn`, or `blocked`
- checked files
- command and props used
- issues grouped by must-fix versus polish
- exact rerender instructions
