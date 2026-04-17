# Storyboard Contract

This document defines the storyboard format that every Motion Studio workflow should produce or consume before render.

## Why a Contract

Without a stable storyboard shape, the same brief produces inconsistent motion output and cannot be reused across cutdowns. The storyboard is the source of truth, the render is a downstream projection.

## Required Fields

A Motion Studio storyboard must contain:

- `id`: stable identifier for the storyboard
- `title`: human-facing title
- `goal`: what this video is supposed to accomplish
- `audience`: target viewer in one short clause
- `targets`: array of intended outputs, each with `aspect`, `duration`, `channel`
- `scenes`: ordered scene list
- `assets`: list of referenced assets with their resolved location
- `audio`: voiceover, music, and ambient track plan
- `captions`: caption track plan including language, position, and style
- `coverFrame`: which scene or timestamp should be used as the cover

## Scene Shape

Every scene must declare:

- `index`: position in the sequence
- `name`: short scene name
- `intent`: what the scene communicates
- `durationFrames`: scene duration in frames
- `composition`: layout and motion description
- `transitionsIn` and `transitionsOut`
- `assetRefs`: which assets are used
- `motionTokens`: named motion behaviors such as `easeIn`, `holdAndPan`, `scaleReveal`
- `notes`: free-form notes for the renderer or the reviewer

## Multi-Format Discipline

The storyboard expresses one source of truth. Each `target` may impose:

- a different `aspect`
- a different `duration`
- a different caption layout
- a different cover frame

The renderer is responsible for resolving target-specific layouts. The storyboard should not duplicate the same scene multiple times for different formats.

## Versioning

Every storyboard must carry a `version` field. Changes that alter scene order, scene intent, or target list increment the major version. Style-only changes increment the minor version.

## Out of Scope

The storyboard is not the place to:

- choose specific model identifiers
- store large binary payloads
- describe deployment, distribution, or scheduling

These belong in render configs, asset storage, and schedule seeds respectively.
