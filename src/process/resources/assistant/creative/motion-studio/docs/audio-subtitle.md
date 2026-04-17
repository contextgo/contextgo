# Audio and Subtitle Handling

Motion Studio output without disciplined audio and caption handling tends to fail review on the second pass. This document defines the package-level rules.

## Audio Tracks

Each storyboard may declare:

- `voiceover`: structured narration with timing
- `music`: background music with mood and intensity hints
- `ambient`: environmental sound or scene-specific audio cues

Tracks must declare:

- `id`
- `source`: asset reference
- `gain`
- `start` and `end` in frames
- `fadeIn` and `fadeOut`
- `language` for voiceover

## Voiceover Discipline

- voiceover should be scripted at the storyboard level, not improvised inside the renderer
- voiceover timing should be aligned to scene boundaries when possible
- when voiceover length conflicts with scene duration, the renderer must report a conflict instead of silently truncating

## Captions

- captions are required for any storyboard with a `social` channel target
- captions must declare `language`, `position`, `fontFamily` token, `maxLineWidth`, and `safeArea`
- captions must respect channel-specific safe areas, especially for vertical and square targets
- caption styles should reuse design tokens from the workspace design system when available, instead of introducing per-scene typography

## Multi-Language Support

When a storyboard declares multiple caption languages:

- each language is a separate caption track
- the renderer should produce one cutdown per language target if requested
- captions in different languages should not share line break logic; they must be re-flowed per language

## Audio QC Hooks

The pre-render hook must verify:

- voiceover assets exist and are readable
- voiceover length matches scene budget
- caption coverage matches voiceover coverage when both exist
- music assets are present and licensed for the declared channel

If any check fails, the render does not start.
