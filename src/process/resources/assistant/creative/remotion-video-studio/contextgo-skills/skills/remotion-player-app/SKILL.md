---
name: remotion-player-app
description: Embed Remotion Player in React, Vite, Next, or product surfaces with parameterized props, bundle boundaries, and preview controls.
---

# Remotion Player App

Use this skill when a user wants a web app or product surface that previews or personalizes a Remotion composition.

## Rules

- Keep Player usage separate from final render scripts.
- Use typed props that match the composition schema.
- Avoid loading server-only renderer APIs into browser bundles.
- Provide predictable controls: play/pause, scrub, variant selection, aspect-ratio preview, and input props where relevant.
- For production rendering, hand off to `remotion-render-ops` or `remotion-lambda` instead of relying on the Player.
