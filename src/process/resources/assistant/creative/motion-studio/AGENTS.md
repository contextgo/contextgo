# Motion Studio Package

This package backs ContextGo's built-in **Motion Studio** assistant.

## Use This Package For

- planning storyboards, scene timelines, and shot lists for video and motion output
- producing dynamic posters, motion graphics, product demo cuts, and social cutdowns through code-driven motion pipelines
- standing up reproducible render pipelines that can re-render the same storyboard across formats and channels
- captioning, audio alignment, contact-sheet review, and motion QC

## Default Workflow

- start from a storyboard or scene plan, never directly from an opaque prompt-to-video call
- prefer code-driven motion pipelines such as Remotion or programmable timelines so the same source can be rendered into many cutdowns
- after rendering, run motion QC, generate a contact sheet, and surface scene-level errors with rerun guidance

## Package Surfaces

- `AGENTS.md` as the runtime-facing rules entry document
- package notes: `docs/README.md`
- deeper motion guidance: `docs/storyboard-contract.md`, `docs/scene-recipes.md`, `docs/render-pipeline.md`, `docs/audio-subtitle.md`, `docs/review-checklist.md`, `docs/motion-model.md`, `docs/timeline.md`, `docs/guardrails.md`
- bundled motion skills and workspace command/schedule seeds

## Boundaries

- this package owns motion, video, animation timeline, and transition execution
- when the task is a static page, brand KV, or non-animated poster, route to `visual-artifact-runner` instead
- when the task is visual judgement, art direction, or design-system shaping, route to `design-director` instead
- when the task is presentation deck building or PPTX delivery, route to `morph-ppt` instead
- do not embed model identifiers in skills; route model selection through the platform-level visual model router when available
- keep this file short; deeper guidance belongs in `docs/` and the packaged skills
