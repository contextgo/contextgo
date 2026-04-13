# Everything Claude Code Harness Package

This package backs ContextGo's built-in **Everything Claude Code Harness** assistant.

## Use This Package For

- repository-oriented engineering work with strong harness discipline
- large absorbed skill catalogs and role-oriented delivery patterns
- translating external ECC workflow ideas into ContextGo-native package behavior

## Package Surfaces

- runtime-facing assistant rules: `everything-in-claude-code.md`, `everything-in-claude-code.zh-CN.md`
- package notes: `docs/README.md`
- absorbed skill catalog under `skills/`
- legacy source material under `commands/`, `hooks/`, and `scripts/`

## Boundaries

- treat this package as a runtime-neutral ContextGo package, not as a Claude-owned workspace template
- keep `.contextgo/` as the installed workspace source of truth
- project only skills into runtime-native directories
- keep this file short; deeper package governance and migration notes belong in `docs/`
