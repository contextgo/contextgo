---
name: executing-plans
description: Use when a written plan already exists and the task should now be implemented in a controlled sequence with verification checkpoints.
---

# Executing Plans

Execute the plan; do not improvise around it without saying so.

Workflow:

1. Read the plan critically before changing code. Flag gaps or contradictions first.
2. Execute in order unless a dependency forces a resequence.
3. Keep the current step explicit: what changed, what is still pending, and what verification is due next.
4. Re-run the smallest meaningful validation loop after each risky step.
5. If the runtime supports delegation and the user asked for it, switch to `subagent-driven-development`. Otherwise stay inline.
6. When implementation is complete, hand off to `requesting-code-review`, `verification-loop`, or `finishing-a-development-branch` as appropriate.

If the plan stops matching reality, update the plan instead of silently freelancing.
