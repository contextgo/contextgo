---
name: remotion-lambda
description: Plan Remotion Lambda workflows, AWS requirements, deployment guardrails, and cloud render handoff without deploying by default.
---

# Remotion Lambda

Use this skill only when the user explicitly asks for cloud or large-scale Remotion rendering.

## Guardrails

- Do not deploy Lambda infrastructure without explicit user intent.
- Confirm AWS account, region, permissions, cost tolerance, and Remotion license status first.
- Keep AWS credentials workspace-scoped; never write secrets into package files or source code.
- Produce a plan before running deployment commands.
- Record function version, region, composition id, props, output bucket, and cost-relevant settings in the manifest.

For local or SSR rendering, use `remotion-render-ops` instead.
