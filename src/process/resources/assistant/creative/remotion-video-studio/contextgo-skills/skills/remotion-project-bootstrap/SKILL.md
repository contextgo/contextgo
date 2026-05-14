---
name: remotion-project-bootstrap
description: Bootstrap or normalize a Remotion project inside a ContextGo workspace, including package manager choice, scripts, folder layout, and workspace recording.
---

# Remotion Project Bootstrap

Use this skill when a user wants to create, import, or normalize a Remotion project.

## Workflow

1. Confirm project id, target output dimensions, fps, expected duration, package manager, and whether Tailwind is wanted.
2. Prefer `npx create-video@latest --yes --blank --no-tailwind <project>` unless the workspace already has a package manager convention or the user requests a template.
3. Put durable notes under `docs/videos/remotion/projects/<project-id>/`.
4. Record package manager, Remotion version, scripts, composition ids, and the source path.
5. Load `remotion-best-practices` before editing Remotion code.

## Baseline Scripts

Prefer scripts that expose:

- `dev` or `studio` for Remotion Studio
- `still` for a representative frame check
- `render` for local MP4/WebM render
- `render:ssr` when Node/Bun server-side rendering is required

Do not add AWS Lambda deployment scripts unless the user explicitly asks for cloud rendering.
