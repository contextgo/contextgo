# Motion Workspace Documentation

This workspace is set up for code-driven motion production. The documentation tree separates storyboards, scenes, renders, and QC so that the same source can drive multiple outputs reproducibly.

## Tree

- `storyboards/` for validated storyboard JSON and scene scripts
- `scenes/` for project-specific scene recipes and overrides
- `renders/` for render configs, manifests, and contact sheets
- `qc/` for review reports, rerun decisions, and approval status

## Authoring Rule

- treat the storyboard as the source of truth
- treat renders and contact sheets as projections of the storyboard
- never edit a render output by hand; rerender from the source
