# Storyboard Shape Reference

Use this reference when authoring or validating a storyboard.

## Required Fields

- `id`
- `version`
- `title`
- `goal`
- `audience`
- `targets[]`
- `scenes[]`
- `assets[]`
- `audio` with optional `voiceover`, `music`, `ambient`
- `captions[]`
- `coverFrame`

## Target Shape

- `targetId`
- `aspect`: `9:16`, `1:1`, `16:9`, or other documented ratio
- `durationFrames`
- `channel`: `social`, `event`, `display`, `web`, `internal`
- `captionRequired`
- `coverFrameOverride` (optional)

## Scene Shape

- `index`
- `name`
- `intent`
- `durationFrames`
- `composition`
- `transitionsIn`
- `transitionsOut`
- `assetRefs[]`
- `motionTokens[]`
- `notes` (optional)
- `recipeId` (optional)

## Asset Shape

- `assetId`
- `kind`: `image`, `video`, `audio`, `font`, `lottie`, `ui-capture`
- `path`
- `version`
- `licenseSuitability[]`

## Audio Track Shape

- `trackId`
- `layer`: `voiceover`, `music`, `ambient`
- `source`
- `gain`
- `start`
- `end`
- `fadeIn`
- `fadeOut`
- `language` (voiceover only)

## Caption Track Shape

- `trackId`
- `language`
- `position`
- `fontFamilyToken`
- `maxLineWidth`
- `safeArea`

## Validation

A storyboard is invalid if any required field is missing or any reference fails to resolve. Renderers must reject invalid storyboards.
