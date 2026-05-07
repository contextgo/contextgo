# HyperFrames Video Workspace

This workspace is configured for deterministic HyperFrames video production.

## Rules

- Store HyperFrames source projects under `docs/videos/projects/`.
- Store source assets under `docs/videos/assets/`.
- Store render manifests under `docs/videos/manifests/`.
- Store rendered MP4/WebM files under `docs/videos/renders/`.
- Store QC reports under `docs/videos/qc/`.
- Do not call image/video generation models from HyperFrames skills.
- Use AI Media Studio when model-generated assets are needed, then reference those outputs from render manifests.
- Do not mark a render final until `hyperframes-qc` has a verdict.

## Recommended Flow

1. Normalize the video brief.
2. Prepare assets and source data.
3. Author or adapt the HyperFrames composition.
4. Preview, render, and write a manifest.
5. Run QC and report output paths.
