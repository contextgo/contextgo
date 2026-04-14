# Hooks Surface

Use this document when the task touches hook-triggered automation, hook configuration, or hook debugging.

## What Hooks Mean Here

- Hooks are ContextGo workspace automation, not language-level instructions.
- Installed hook payload lives under `.contextgo/hooks/`, and selection state lives in `.contextgo/hooks.json`.
- Hook behavior should be reasoned about as product automation that triggers around tool or workflow events.

## Open This Doc When

- enabling or disabling hook behavior for a workspace
- debugging why a hook fired, warned, or blocked
- deciding whether a guardrail belongs in a hook instead of a prompt instruction
- translating absorbed ECC hook ideas into ContextGo-native automation

## Authoring Guidance

- Keep behavioral source of truth in package payloads and installed workspace state.
- Use workspace docs to explain hooks, not to re-encode them as permanent model rules.
- Avoid modeling hooks as Claude-only, Codex-only, or any other runtime-only structure.
