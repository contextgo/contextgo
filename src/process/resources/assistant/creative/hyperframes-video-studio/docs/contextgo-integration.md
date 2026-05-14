# ContextGo Integration

## Package Model

HyperFrames Video Studio is a runtime-neutral Agent Package. Its skills can project into runtime-native skill directories, while the package manifest remains the source of truth.

## Commands

Workspace commands should call the package skills and keep generated files under `docs/videos/`.

## Schedules

Schedule templates are disabled by default. Users can enable them and retarget `conversationId` after workspace setup.

## AI Media Studio Bridge

When AI Media Studio is installed, use `ai-media-to-hyperframes` to consume:

- generated images and videos
- task manifests
- QC reports
- prompt/source notes

Do not move or rewrite AI Media Studio task manifests. Reference them from HyperFrames render manifests.
