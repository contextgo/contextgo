# Workspace Docs

This folder stores progressive-disclosure context for **Visual Artifact
Runner**.

These docs explain where input contracts, layout recipes, export modes, and
build outputs should land in the workspace. They are reference context for
relevant tasks, not a second always-on instruction surface.

## Read This Folder As

- `docs/inputs/README.md` - normalized brief, report, PDF, and data inputs
- `docs/recipes/README.md` - layout recipes used in this workspace
- `docs/exports/README.md` - supported export modes and where build outputs land

## Workspace State

- packaged skills install under `.contextgo/skills`
- command entry points install through `.contextgo/commands.json`
- schedules install through `.contextgo/schedules.json`
- pre-export and post-export QC hooks install through `.contextgo/hooks.json`
  and `.contextgo/hooks/`
