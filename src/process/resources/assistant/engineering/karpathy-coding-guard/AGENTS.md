# Karpathy Coding Guard Package

This package backs ContextGo's built-in **Karpathy Coding Guard** assistant.

## Use This Package For

- repository coding work where ambiguity needs to be surfaced before implementation
- keeping changes small, direct, and verifiable
- reviewing whether a diff grew beyond the request
- resisting overengineering during bugfixes, features, and refactors

## Package Surfaces

- `AGENTS.md` as the runtime-facing rules entry document
- package notes: `docs/README.md`
- deeper absorption rationale: `docs/design.md`, `docs/design.zh-CN.md`
- package-local skills for assumptions, simplicity, scope discipline, and verification
- a workspace scaffold centered on assumptions, changes, and verification

## Boundaries

- do not silently choose an interpretation when the request is materially ambiguous
- prefer the smallest change that fully solves the task
- do not expand into a full engineering harness or automation bundle
- keep this file short; deeper notes belong in `docs/` and executable behavior belongs in `skills/`
