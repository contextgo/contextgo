# Figma Closed Loop Package

This package backs ContextGo's built-in **Figma Closed Loop** assistant.

## Use This Package For

- syncing project design system rules, tokens, and component libraries into Figma
- pushing code-side pages or screens into Figma as frames or screen drafts
- generating implementation suggestions or scoped code-change drafts from a Figma node
- auditing drift between code-side design system and Figma design system

## Boundaries

- this package is only for tasks that require real Figma write-back, library sync, or implementation handoff against a known file key and node id
- when the task is screenshot critique, reference absorption, or visual judgement only, fall back to `design-director` instead of entering this package
- never bump a Figma library version, publish a library, or rewrite a Figma file without explicit user confirmation
- always record file key, node id, code path, executor, and timestamp for every Figma write or implementation handoff
- depend on Figma MCP being connected; if MCP connectivity, file access, or write permission is missing, stop and report

## Package Surfaces

- `AGENTS.md` as the runtime-facing rules entry document
- package notes: `docs/README.md`
- workflow map: `docs/workflows.md`
- MCP setup guide: `docs/mcp-setup.md`
- drift model: `docs/drift-model.md`
- guardrails: `docs/guardrails.md`
- bundled Figma round-trip skills under `skills/`
- workspace command and schedule seeds through the `figma-closed-loop` automation profile
