---
name: remotion-render-ops
description: Run Remotion Studio, still checks, local renders, SSR renders, output naming, logs, and render manifest handoff.
---

# Remotion Render Ops

Use this skill when moving from source code to rendered output.

## Sequence

1. Verify dependencies and package scripts.
2. Start or inspect Remotion Studio for interactive preview when useful.
3. Render at least one still frame before full render.
4. Run local render for ordinary jobs.
5. Use `@remotion/renderer` SSR only when the workflow needs server-side props, API integration, or product embedding.
6. Write a render manifest with command, props, versions, assets, outputs, and logs.
7. Hand off to `remotion-qc`.

## Output Naming

Use stable names:

```text
<project-id>__<composition-id>__<variant>__<width>x<height>__<fps>fps__v<revision>.mp4
```

Keep experimental renders separate from publish candidates.
