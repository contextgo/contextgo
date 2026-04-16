# Workbench Host Foundation Design

## Goal

Land the first stable `WorkbenchHost` abstraction in renderer code so the app shell no longer treats conversation as the implicit middle-area default.

## Scope

This phase is intentionally narrow:

- add a lightweight `WorkbenchHost` renderer container
- define the first `workbenchKind`: `conversation-cowork`
- route `/conversation/:id` through the host layer
- expose host context so later workbench-aware UI can consume it
- preserve the existing `ChatLayout` implementation unchanged

## Non-Goals

- no visual redesign of the conversation shell
- no capability registry beyond the single `workbenchKind` contract
- no new workbench routes for image, document, browser, or space surfaces
- no channel, upload, or WeCom work

## Why This Slice Exists

Issue `#188` is a product and architecture direction change first. The current code still makes the conversation page the direct middle-area surface. That blocks the repository from truthfully modeling conversation as one workbench among many.

This foundation changes the routing truth without forcing a large UI rewrite:

- the shell hosts workbenches
- conversation becomes the first explicit workbench slice
- future workbench-specific UX can attach to host context instead of hard-coding conversation-first assumptions

## Implementation Shape

- create `src/renderer/pages/WorkbenchHost/`
- add a typed context for `WorkbenchKind`
- wrap `/conversation/:id` in `WorkbenchHost`
- keep the host implementation minimal: provider plus a stable container element

## Acceptance Criteria

- `/conversation/:id` mounts through `WorkbenchHost`
- `WorkbenchHost` receives `workbenchKind='conversation-cowork'`
- existing router behavior for conversation parameter changes remains stable
- existing renderer shell tests stay green
