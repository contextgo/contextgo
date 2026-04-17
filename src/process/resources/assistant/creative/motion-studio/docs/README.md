# Motion Studio Package Notes

This package contains the built-in motion-execution assistant and its package-level guidance.

## Main Purpose

Motion Studio exists so video, motion graphics, animated posters, and social cutdowns stop being one-off prompt experiments and start behaving like a reproducible production pipeline.

The package is optimized for:

- storyboard authoring and scene composition
- code-driven motion pipelines such as Remotion timelines
- multi-format render and cutdown for posters, demos, social, and event reels
- motion QC, contact-sheet generation, and rerun guidance
- caption, voiceover, and audio-track alignment

## Package Surfaces

- `AGENTS.md`
  - runtime-facing rules entry document
- package root
  - `src/process/resources/assistant/creative/motion-studio`
- skill source
  - `src/process/resources/skills/motion-studio-pack`
- deeper guidance
  - `storyboard-contract.md` for the storyboard data shape
  - `scene-recipes.md` for reusable scene templates
  - `render-pipeline.md` for rendering, encoding, and storage rules
  - `audio-subtitle.md` for caption and voiceover handling
  - `review-checklist.md` for QC and approval gates
  - `motion-model.md` for the motion / cinematography vocabulary used inside the package
  - `timeline.md` for timeline-level composition rules
  - `guardrails.md` for hard execution boundaries

## Stable Package Behaviors

This package should continue to:

- treat storyboard as the source of truth, render as a downstream projection
- reuse the same source storyboard to drive multiple sizes, aspect ratios, and channel cuts
- attach scene, asset, and render config metadata to every produced artifact
- surface scene-level failure modes instead of returning an opaque render error
- not collapse into static-poster, deck, or document-design behavior

## Workspace Commands

This package seeds commands such as:

- `storyboard-video`
- `build-motion-poster`
- `render-video`
- `render-social-cut`
- `motion-qc`

## Workspace Schedules

This package currently does not seed recurring schedules by default. `.contextgo/schedules.json` is still materialized through the automation profile so teams can add project-specific motion rerun or QC cadences.

## Installation Surfaces

- `.contextgo/skills`
  - installs the motion workflow skills declared by the preset package
- `.contextgo/commands.json`
  - seeded through the `motion-studio` workspace automation profile
- `.contextgo/schedules.json`
  - seeded through the `motion-studio` workspace automation profile (currently empty by default)
- runtime-native directories
  - only receive projected skills when the runtime expects its own native skill directory

## Authoring Rule

Keep runtime persona rules in `AGENTS.md`, package-level notes in `docs/`, and executable workflows in the packaged skills.
