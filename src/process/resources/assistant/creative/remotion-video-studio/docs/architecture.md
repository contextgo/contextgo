# Architecture

Prefer one Remotion project per durable video system or campaign. Keep generated source assets and render outputs outside opaque temp paths so the workspace can audit lineage and rerun work later.

## Project Layout

```text
docs/videos/remotion/
  briefs/
  projects/
  assets/
  renders/
  manifests/
  qc/
```

Within each Remotion project:

- `src/Root.tsx` registers compositions.
- `src/compositions/` owns reusable video components.
- `src/scenes/` owns scene-level components when the timeline is complex.
- `src/data/` owns typed props, schemas, and fixture inputs.
- `public/` contains render-time static assets copied from workspace asset ledgers.
- `renders/` or the workspace `docs/videos/remotion/renders/` path stores outputs.

## Composition Contract

Every durable composition should record:

- composition id
- width, height, fps, duration in frames
- input props schema
- asset paths and provenance
- expected output format
- known license constraints
- still-check frame list
- render command and manifest path
