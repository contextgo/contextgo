# Everything Claude Code Harness Package Notes

This package contains ContextGo's absorbed **Everything in Claude Code** harness package.

## Main Purpose

This package exists to preserve the useful parts of the open-source ECC ecosystem while translating them into ContextGo's product model.

That means:

- the skill catalog remains valuable
- the role-oriented engineering posture remains valuable
- the package should no longer define the product boundary through Claude-specific workspace structure

## Package Surfaces

- `everything-in-claude-code.md` and `everything-in-claude-code.zh-CN.md`
  - runtime-facing assistant rules
- package root
  - `src/process/resources/assistant/engineering/everything-in-claude-code`
- `skills/`
  - absorbed ECC skill catalog
- `commands/`
  - legacy command source material kept for migration and translation
- `hooks/` and `scripts/`
  - legacy hook payload and source logic retained as absorbed package material
- `hooks.md`
  - package-level documentation for the absorbed hook payload

## Current Product Translation Rule

Inside ContextGo, this package should be interpreted as:

- packaged skills that install into `.contextgo/skills`
- ContextGo-native command seeds that install into `.contextgo/commands.json`
- ContextGo-native schedules that install into `.contextgo/schedules.json`
- runtime-native skill projection only where required for runtime compatibility

It should **not** be treated as a reason to generate a full `.claude` workspace structure for non-Claude runtimes.

## Installation Surfaces

- `.contextgo/skills`
  - installs the package-local `skills/` payload through `agent-package.json` and its `packaged-skills` bootstrap strategy
- `.contextgo/commands.json`
  - seeded through the `everything-claude-code` workspace automation profile
- `.contextgo/schedules.json`
  - seeded by ContextGo with the standard conversation schedule container for this package
- `.contextgo/hooks/` and `.contextgo/hooks.json`
  - not currently seeded by default from this package, even though legacy hook payload remains bundled here
- runtime-native directories
  - only receive projected skills where runtime compatibility requires a native skill directory

## Stable Package Behaviors

This package should keep favoring:

- linked-workspace repository execution
- explicit planning, implementation, review, and verification loops
- reusable harness patterns that ContextGo can own at the product layer

## Authoring Rule

Keep the absorbed package boundary visible:

- runtime-facing assistant behavior stays in the localized root files
- package and migration notes stay in `docs/`
- legacy absorbed source material stays in `commands/`, `hooks/`, and `scripts/`
- executable task behavior continues to live in packaged skills

## Migration Status

This package is intentionally the least-normalized bundled package because it still carries absorbed legacy payload from the upstream ECC project.

Current status:

- package-local skills already live under the package root
- legacy command and hook payload is retained for translation and future productization
- default workspace bootstrap is already runtime-neutral and does not recreate a full `.claude` workspace structure for non-Claude runtimes

The long-term target is still Agent Package v1 with `.contextgo/` as the canonical installation root and runtime-native directories treated as projections only.
