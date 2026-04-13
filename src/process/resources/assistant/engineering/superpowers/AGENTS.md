# Superpowers Harness Package

This package backs ContextGo's built-in **Superpowers Harness** assistant.

## Use This Package For

- repository-based engineering work
- spec and planning discipline before coding
- TDD, review, debugging, and verification workflows
- ContextGo-native workspace automation for engineering delivery

## Package Surfaces

- runtime-facing assistant rules: `superpowers.md`, `superpowers.zh-CN.md`
- package notes: `docs/README.md`
- bundled engineering workflow skills installed from the packaged skill set
- ContextGo-native workspace automation seeded under `.contextgo/`

## Boundaries

- treat this package as a runtime-neutral engineering harness, not as a runtime-owned preset
- keep hook, command, and schedule behavior modeled as ContextGo-native automation
- keep this file short; deeper package governance belongs in `docs/`
