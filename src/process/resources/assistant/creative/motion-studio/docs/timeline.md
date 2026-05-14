# Timeline

The timeline is the composition surface where scenes, audio, captions, and transitions resolve into a single playable artifact.

## Timeline Layers

A Motion Studio timeline is composed of fixed layers:

- `scenes` layer: visual scenes in order
- `audio.voiceover` layer: narration tracks
- `audio.music` layer: background music
- `audio.ambient` layer: ambient or scene-bound sound
- `captions` layer: caption tracks per language
- `overlays` layer: persistent identity, lower-thirds, channel safe-area frames

The renderer must compose layers in this stacking order; storyboards must not invent new top-level layers.

## Time Units

- the timeline uses frames as the canonical time unit
- the storyboard may declare a project frame rate; if absent, the renderer assumes 30 fps
- scene durations are expressed in frames, not seconds
- audio tracks expose `start` and `end` in frames after resolution

## Scene Boundary Rules

- transitions cross scene boundaries; their duration is split across the boundary
- captions should not cross scene boundaries unless the storyboard explicitly requests `captionContinuity`
- voiceover may cross scene boundaries when the script requires it
- music may cross scene boundaries freely

## Multi-Target Resolution

When the timeline resolves for a target:

- aspect ratio reframes apply per scene
- captions reflow per target safe area
- duration trimming chooses scenes based on the storyboard's `cutdownPlan` if present, never by silently dropping scenes from the end

## Determinism

The same storyboard, same recipe versions, and same render config must always produce the same timeline. Random behavior is allowed only through the explicit `seed` field in the render config.

## Diagnostics

The timeline composer must emit:

- a frame-level scene map
- a frame-level caption coverage report
- a frame-level audio coverage report

These diagnostics feed the QC report and the post-render contact sheet.
