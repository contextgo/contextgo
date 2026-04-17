# Context Namespace And Projection Design

## Goal

Close `#129` and `#142` by turning the current Context Engine output surfaces into a first-class Context Namespace and by clarifying how vault projection is layered, so users, agents, and future UI surfaces all talk about the same contextual objects.

## Fixed Constraints

This work must preserve the architecture already running on `main`:

- governance remains owned by:
  - `Session Steward`
  - `Project Curator`
  - `Space Curator`
- the runtime remains a dual-loop system:
  - session loop
  - project/space evolution loop
- capability surfaces remain ContextGo-native:
  - agent packages
  - skills
  - hooks
  - commands
  - schedules
- current retrieval, assembly, and governance traces remain the source of runtime truth

This PR must not:

- create a second context model unrelated to the current artifacts
- collapse semantic context, source mirrors, and capability inventory back into one undifferentiated graph layer
- redesign the renderer into a brand-new context browser product surface

## What This PR Is Actually Doing

This PR is not inventing a new engine.

It is doing three concrete things:

1. naming the existing context surfaces as one coherent namespace
2. separating vault projection into semantic context, source mirror, and capability inventory layers
3. making current graph/canvas output respect those layers instead of flattening them

## Existing Code Mapping

### 1. Semantic context surfaces already exist

Current code already writes high-value semantic context objects:

- project baseline
- project insights
- session working context / working set
- session checkpoints
- space memory
- profile memory
- connector digest

Primary files:

- `src/process/services/space/SpaceVaultContextSyncService.ts`
- `src/process/services/context/jobs/*`

### 2. Source mirror surfaces already exist

Current code already mirrors:

- `AGENTS.md`
- `README.md`
- selected markdown docs
- source graph edges

Primary files:

- `src/process/services/space/ProjectContextMirrorService.ts`
- `src/process/services/space/SpaceVaultContextSyncService.ts`

### 3. Capability inventory already exists

Current code already reads and projects:

- `.contextgo/skills`
- `.contextgo/hooks`
- `.contextgo/commands`
- `.contextgo/schedules`

Primary files:

- `src/process/services/space/ProjectCapabilityService.ts`
- `src/process/services/space/SpaceVaultContextSyncService.ts`

The problem is not missing material. The problem is that these three layers are still too easy to confuse in projection, canvas output, and product language.

## Issue `#129`: Context Namespace / Context Tree

### Current baseline

The codebase already has the raw materials for a namespace:

- space-level docs
- project-level docs
- session-level docs
- memory/profile surfaces
- capability surfaces

But they are still surfaced through a mix of file layout, runtime assembly, and generated notes rather than a single shared namespace language.

### Required direction

This PR should define a namespace vocabulary that maps directly to current code and artifacts:

- `space`
- `project`
- `session`
- `semantic-context`
- `source-mirror`
- `capability-inventory`

It should also define stable node identities and ownership at the type/documentation layer.

### Minimal implementation target

Introduce an explicit namespace/node model for the current projection surfaces and wire current projection writers to that model.

This does not require building a tree UI yet.

## Issue `#142`: Vault Graph / Projection Layering

### Current baseline

Current vault projection writes many useful surfaces, but graph/canvas output still leans too heavily toward flattening:

- semantic context
- source docs
- capability docs

can all end up looking like equal-weight graph nodes.

### Required direction

This PR should formalize three projection layers:

1. semantic context
2. source mirror
3. capability inventory

And make the current default graph/canvas output favor semantic context first.

### Minimal implementation target

This does not require a new graph UI.

It requires:

- explicit projection-layer metadata
- graph/canvas generation rules that stop treating all node classes as equal
- a clearer separation between what is default-visible and what is drill-down / mirrored

## Concrete Design Direction

### 1. Introduce explicit namespace/projection metadata

The current vault projection layer should be able to mark an object as belonging to one of:

- semantic context
- source mirror
- capability inventory

This metadata should be derivable from current generated artifacts, not from a second shadow store.

### 2. Keep file layout but clarify meaning

This PR should not replace the existing vault layout.

Instead, it should make the existing layout readable through namespace/projection semantics:

- current paths stay
- their product/runtime meaning becomes explicit

### 3. Make graph output semantic-first

The current default graph/canvas generation should:

- prioritize semantic context nodes
- keep source mirrors available for provenance and drill-down
- keep capability inventory separate from semantic runtime context

### 4. Keep runtime assembly aligned

The namespace/projection layer must align with the current retrieval and assembly path rather than drifting away from it.

If an object is part of semantic context, its projection layer should not contradict how the runtime treats it.

## File Plan

Primary files expected to change:

- `src/process/services/space/SpaceVaultContextSyncService.ts`
- `src/process/services/space/vaultLayout.ts`
- `src/process/services/space/ProjectContextMirrorService.ts`
- `src/process/services/space/ProjectCapabilityService.ts`

Likely supporting files:

- `packages/context-engine/docs/domain-model.md`
- `packages/context-engine/docs/reference-landscape.md`
- `tests/unit/process/services/spaceVaultContextSyncService.test.ts`
- `tests/unit/process/services/projectCapabilityService.test.ts`

## Testing Strategy

This PR should prove three things:

### 1. Namespace semantics are explicit

Verify:

- current generated artifacts can be classified into the three projection layers
- semantic/session/project/space ownership can be derived consistently

### 2. Projection layering is no longer flat

Verify:

- default graph/canvas output favors semantic context
- source docs remain mirrored but are no longer implicitly treated as equal semantic nodes
- capability inventory remains available but separate

### 3. Runtime compatibility is preserved

Verify:

- vault projection changes do not break current assembly/runtime use of baseline, insights, session working context, or capability mirrors

## Non-Goals

This PR does not close:

- `#128` evaluation/regression baseline
- `#138` external memory strategy adapter SPI

It is part of the path to an eventually coherent epic close-out.

## Success Criteria

This PR is successful when:

- current contextual objects can be named and grouped through one namespace vocabulary
- vault projection stops flattening semantic context, source mirrors, and capability inventory into one conceptual layer
- the default graph/projection path becomes more aligned with actual runtime semantics
