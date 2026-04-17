# Render Pipeline

Motion Studio uses a code-driven render pipeline so the same storyboard can be rendered into many cutdowns and revisited reproducibly.

## Pipeline Stages

1. Resolve storyboard
   - validate against the storyboard contract
   - resolve referenced assets and recipes
   - reject storyboards that fail validation
2. Plan render targets
   - expand each storyboard `target` into a concrete render config
   - apply target-specific aspect, duration, caption layout, and cover frame
3. Pre-render checks
   - run the pre-render hook, including duration, asset presence, caption coverage, cover frame, and export spec
4. Render
   - use the configured code-driven motion runtime, default `Remotion`, to render frames into video output
5. Post-render
   - generate a contact sheet
   - emit a render manifest with scene-level metadata and asset references
6. Failure recovery
   - if any scene fails, persist scene-level diagnostics and a rerun suggestion

## Render Config Shape

Each render config carries:

- `storyboardId` and `storyboardVersion`
- `target`: aspect, duration, channel
- `output`: file path, codec, container, bitrate
- `motionRuntime`: identifier of the runtime, default `remotion`
- `assets`: resolved asset paths
- `captions`: resolved caption track
- `audio`: resolved audio plan
- `seed`: deterministic seed for any randomness

## Reproducibility Rule

A render is reproducible only if all of the following are stable:

- storyboard version
- recipe versions
- asset versions
- motion runtime version
- render config including seed

Pipelines must persist these inputs alongside the output.

## Storage Layout

Within the workspace:

- `docs/storyboards/<storyboardId>/storyboard.json`
- `docs/scenes/<recipeId>.md`
- `docs/renders/<storyboardId>/<targetId>/manifest.json`
- `docs/renders/<storyboardId>/<targetId>/contact-sheet.png`
- `docs/qc/<storyboardId>/<targetId>/report.md`

This layout keeps inputs, outputs, and reviews discoverable without scanning binary blobs.
