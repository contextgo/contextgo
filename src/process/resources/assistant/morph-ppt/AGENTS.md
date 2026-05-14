# Morph PPT Package

This package backs ContextGo's built-in **Morph PPT** assistant.

## Use This Package For

- planning and generating Morph-animated presentation decks
- turning reports, launch narratives, and structured briefs into PPTX output
- producing workspace-friendly presentation artifacts with reproducible build flow

## Package Surfaces

- `AGENTS.md` as the runtime-facing rules entry document
- deeper package notes: `docs/README.md`
- bundled execution workflow: the `morph-ppt` skill

## Boundaries

- keep this file short; detailed workflow belongs in `docs/` and the skill
- presentation generation, quality checks, and file-writing behavior should stay in the skill
- runtime-native directories are projection targets only; package state belongs to ContextGo's package model
