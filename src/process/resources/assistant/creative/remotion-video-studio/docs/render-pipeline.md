# Render Pipeline

Use a staged pipeline so failures are cheap and reviewable.

## Stages

1. Plan composition: dimensions, fps, duration, scenes, props, assets, captions, and output format.
2. Bootstrap or update the Remotion project.
3. Run Studio preview for interactive checks.
4. Render still frames at representative frame numbers.
5. Run a local render for small and medium jobs.
6. Use SSR with `@remotion/renderer` when the product needs parameterized server-side rendering.
7. Plan Lambda only when the user explicitly wants cloud rendering and has AWS/license readiness.
8. Write the render manifest and run QC.

## Manifest Fields

Record:

- project path and git/workspace state
- package manager and scripts used
- Remotion package versions
- composition id and input props
- dimensions, fps, duration, codec, container, and output path
- still-check frames and results
- asset lineage, including Infermesh task ids when relevant
- render command, logs, start/end time, and rerender instructions
