# Karpathy Coding Guard Package Notes

This package contains ContextGo's built-in coding-constraint assistant inspired by the upstream Andrej Karpathy guidelines repository.

## Main Purpose

Karpathy Coding Guard exists to reduce a narrow but expensive class of AI coding failures:

- silent assumptions
- overbuilt implementations
- unrelated edits
- weak or missing success criteria

The package is optimized for:

- bugfixes
- small to medium feature work
- targeted refactors
- diff review before claiming completion

## Package Surfaces

- `AGENTS.md`
  - runtime-facing rules entry document
- `design.md` and `design.zh-CN.md`
  - package absorption rationale and product boundary
- package root
  - `src/process/resources/assistant/engineering/karpathy-coding-guard`
- package-local skill source
  - `src/process/resources/assistant/engineering/karpathy-coding-guard/skills`
- bundled coding-constraint skills
  - assumption audit
  - simplicity first
  - surgical change
  - goal-driven execution
  - diff minimization review

## Stable Package Behaviors

This package should continue to:

- keep coding ambiguity visible instead of silently choosing an interpretation
- bias toward minimum code and minimum surface area
- treat unrelated cleanup as out of scope by default
- require explicit verification targets before claiming success

## Installation Surfaces

- `.contextgo/skills`
  - installs the coding-constraint skills declared by the package
- runtime-native directories
  - only receive projected skills when the runtime needs its own native skill directory
- `.contextgo/hooks.json`, `.contextgo/hooks/`, `.contextgo/commands.json`, `.contextgo/schedules.json`
  - this package does not currently contribute package-specific automation payloads

## Authoring Rule

Keep runtime persona rules in `AGENTS.md`, package rationale in `docs/`, and executable behavior in `skills/`.
