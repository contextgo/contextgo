---
name: remotion-composition
description: Plan and author Remotion React/TSX compositions with dimensions, fps, duration, props schemas, scene maps, and media ownership.
---

# Remotion Composition

Use this skill for composition design or TSX authoring. Always use `remotion-best-practices` for Remotion-specific APIs and rule details.

## Composition Plan

Define:

- composition id
- width, height, fps, duration in frames
- scene map with frame ranges
- props schema and default props
- public asset paths and lineage
- captions and audio tracks
- still-check frames
- render output target

## Authoring Rules

- Keep reusable scene components small and prop-driven.
- Make dimensions and timing explicit; avoid magic frame numbers without a scene map.
- Use schema-backed props for parameterized renders.
- Separate generated media intake from Remotion component code.
- Preserve exact visible text in the plan so QC can verify it.
