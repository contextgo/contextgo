# Morph PPT Package Notes

This package contains the assistant-facing entry for ContextGo's built-in Morph PPT workflow.

## What Lives Here

- `AGENTS.md`
  - runtime-facing rules entry document and greeting behavior
- package root
  - `src/process/resources/assistant/morph-ppt`
- skill source
  - `src/process/resources/skills/morph-ppt`
- bundled `morph-ppt` skill
  - the real execution workflow for planning, generation, quality checks, and iteration

## Working Model

Morph PPT is optimized for cases where the user already has:

- a presentation topic
- a report, outline, or launch narrative
- visual references, taste direction, or style constraints

The assistant should stay concise at the package entry layer and defer procedural detail to the bundled skill.

## Workspace Expectations

This package works best when the user links a workspace first, because generated artifacts such as:

- PPTX files
- build scripts
- presentation briefs

should be written back into the project folder instead of staying ephemeral.

## Installation Surfaces

- `.contextgo/skills`
  - installs the `morph-ppt` skill into the workspace-owned skill root
- runtime-native directories
  - may receive projected skills such as `.agents/skills`, but those are compatibility projections only
- `.contextgo/commands.json`, `.contextgo/hooks.json`, `.contextgo/hooks/`, `.contextgo/schedules.json`
  - this package does not currently own package-specific seeds for those surfaces

## Important Operating Note

The package should keep reminding users not to open the generated PPT with the system app during active generation if that would lock the file and break the build flow.

That warning belongs in `AGENTS.md` and the generation workflow.

## Authoring Rule

When evolving this package:

- keep `AGENTS.md` as the short entry point
- keep runtime persona and greeting rules in `AGENTS.md`
- keep deck-generation workflow changes in the `morph-ppt` skill
- add deeper package notes here under `docs/`

## Migration Status

This package already has a real package root for rules and docs.

Its executable workflow still lives in the shared skill resource tree under `src/process/resources/skills/morph-ppt`.

That split is acceptable during migration as long as the workspace installation contract remains:

- ContextGo installs into `.contextgo/` first
- runtime-native directories only receive projected skills
