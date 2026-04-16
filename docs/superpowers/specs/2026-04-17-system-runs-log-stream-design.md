# System Runs Log Stream Design

## Goal

Make `System Runs` feel like a runtime console instead of a generic settings list, while making `proposal`, `distillation`, and context artifacts visually easier to distinguish.

## Scope

- keep the existing `System Runs` page and card-based layout
- preserve the current run header summary (`agent`, `state`, `maintenance kind`, `updated time`)
- turn `recent events` into the primary narrative area of each run card
- strengthen artifact classification so artifact-bearing runs are easier to scan
- update DOM tests for the new event-stream behavior

## Non-Goals

- redesigning the entire settings information architecture
- introducing a brand-new backend event schema
- adding filtering, search, or pagination in this patch
- replacing the current run cards with a separate full-screen console surface

## Proposed UI

Each run card keeps a compact summary header, followed by two lighter metadata groups:

- `Routing`: trigger, boundary, governance, source
- `Artifact`: artifact kind, targets, summary, title/path when present

The `recent events` section becomes a structured log stream. Each row should read in a stable order:

`timestamp -> event kind -> artifact/source qualifier -> message`

This means the event text is no longer a plain sentence floating after a badge. It should read like a runtime record, with time and classification visible before the body text.

## Artifact Classification

`proposal`, `space-distillation`, `session-context`, and `project-context` remain derived from the current `artifactTargets` heuristics, but they should become first-class visual qualifiers in the run UI.

Rules for this patch:

- artifact kind stays visible in the run header when available
- artifact kind is repeated inside the artifact metadata group
- artifact-related event rows should surface the artifact qualifier more strongly than generic status rows
- generic non-artifact events should still render as log rows, but with a weaker qualifier treatment

## Event Stream Behavior

The event stream should prioritize runtime feel over prose readability.

- rows are compact and consistent
- timestamps are always visible
- event kind remains a machine-like badge such as `status` or `message`
- the qualifier slot should prefer artifact kind when one exists; otherwise it may fall back to source or stay empty
- only the most recent few events remain visible in-card, matching the current truncation behavior

## Testing

Add or update DOM tests to verify:

- artifact-bearing runs expose their artifact qualifier in the log stream, not only in metadata text
- generic status events still render as normal log rows
- proposal-like runs and session-context runs remain visually distinguishable through rendered labels
- existing empty-state and definition rendering continue to work

## Implementation Notes

This patch should stay renderer-only. It should reorganize presentation using existing `IExtensionSystemRunItem` fields instead of changing IPC or context-engine contracts.
