---
name: hyperframes-media
description: Manage media inputs for HyperFrames video projects, including images, video clips, AI-generated assets, audio, subtitles, fonts, screenshots, remote downloads, workspace paths, and source lineage.
---

# HyperFrames Media

Use this skill to prepare and reference assets for a HyperFrames render.

## Asset Types

- images and screenshots
- video snippets
- generated media from AI Media Studio
- audio, music, voiceover, and sound effects
- subtitles and captions
- fonts and brand assets
- CSV/JSON/table data

## Storage

Use workspace paths:

- `docs/videos/assets/` for source media
- `docs/videos/briefs/` for scripts and subtitle drafts
- `docs/videos/manifests/` for source lineage
- `docs/videos/renders/` for outputs

## Rules

- Prefer local files over remote URLs for repeatable rendering.
- Preserve original filenames when useful, but add stable project prefixes for generated batches.
- Record source URL, license/rights note, and originating task manifest when known.
- For subtitles, keep plain text and timing data in editable source files.
- For fonts, confirm the user has rights to embed/use them in rendered video.

## Output

Return an asset table with id, type, source, local path, usage scene, rights note, and QC risk.
