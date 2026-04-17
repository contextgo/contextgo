# Render Config Reference

A render config carries every input that determines a render output. Persist it next to the output for reproducibility.

## Required Fields

- `storyboardId`
- `storyboardVersion`
- `targetId`
- `aspect`
- `durationFrames`
- `motionRuntime`: identifier of the runtime, default `remotion`
- `motionRuntimeVersion`
- `output`: `path`, `codec`, `container`, `bitrate`
- `assets[]`: resolved paths and versions
- `captions[]`: resolved tracks
- `audio`: resolved tracks
- `seed`: deterministic seed for any randomness

## Optional Fields

- `recipeOverrides[]`
- `cutdownPlan`: which scenes to keep when trimming
- `coverFrameOverride`
- `notes`

## Reproducibility Rule

A render is reproducible only if the storyboard, recipes, assets, motion runtime, and render config match. Persist all of them with the output.

## Storage Layout

- `docs/renders/<storyboardId>/<targetId>/manifest.json`
- `docs/renders/<storyboardId>/<targetId>/contact-sheet.png`
- `docs/renders/<storyboardId>/<targetId>/<output-file>`
