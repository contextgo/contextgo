---
name: ai-media-to-hyperframes
description: Compose AI Media Studio or Infermesh-generated images/videos into final HyperFrames videos with source manifest lineage, subtitles, title cards, transitions, brand wrappers, renders, and QC.
---

# AI Media To HyperFrames

Use when generated images or generated video snippets should become a final edited video.

## Inputs

- generated media files or directories
- AI Media Studio task manifests when available
- desired final duration and aspect ratio
- channel and audience
- title/subtitle/CTA copy
- brand wrapper or template requirements

## Workflow

1. Inventory generated assets and source manifests.
2. Select usable assets and reject failed/QC-blocked inputs.
3. Plan scenes: title, asset montage, captions, transitions, end card.
4. Copy or reference assets under `docs/videos/assets/`.
5. Build composition with `hyperframes-composition`.
6. Render with `hyperframes-cli`.
7. Run `hyperframes-qc`.

## Lineage Rules

- Do not edit AI Media Studio task manifests.
- Reference source task ids and output paths in the HyperFrames render manifest.
- If a source asset has failed QC, mark the final render as blocked or rerun-required unless the user explicitly accepts the risk.

## Output

Return final render path, source asset table, render manifest, QC report, and any upstream asset rerun recommendations.
