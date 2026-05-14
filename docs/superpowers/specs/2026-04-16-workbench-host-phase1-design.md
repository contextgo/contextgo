# Workbench Host Phase 1 Design

## Goal

Land the first real `WorkbenchHost` abstraction in renderer code so the middle area is no longer modeled as "conversation by default".

## Scope

Phase 1 is intentionally minimal:

- introduce a `WorkbenchHost` container and context
- define a first `workbenchKind`: `conversation-cowork`
- route `/conversation/:id` through `WorkbenchHost`
- keep `ChatLayout` unchanged as the current implementation of the `conversation-cowork` workbench

## Non-Goals

- no new image/document/video/music workbenches yet
- no redesign of `ChatLayout`
- no full capability registry yet
- no route migration for every page in one batch

## Why This Is The Right First Step

`#188` is blocked today because the code still treats conversation routes as the direct middle-area product surface. Adding a minimal host layer changes that architectural truth without forcing a large UI rewrite.

After this lands, the codebase can truthfully say:

- the app shell hosts workbenches
- conversation is one workbench kind
- future middle-area surfaces can be added beside it instead of inside it

## Implementation Shape

- add `src/renderer/pages/WorkbenchHost/`
- define `WorkbenchKind = 'conversation-cowork'`
- wrap the conversation route in `WorkbenchHost`
- keep the host component lightweight for now: provider + stable host container

## Acceptance Criteria

- `/conversation/:id` no longer mounts directly under the router without a host layer
- router tests prove the route is mounted through `WorkbenchHost`
- existing shell/router behavior remains intact
