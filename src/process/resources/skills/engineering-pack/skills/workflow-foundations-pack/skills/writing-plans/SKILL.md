---
name: writing-plans
description: Use after requirements or a design are clear and before implementation starts. Turn intent into a concrete, verifiable execution plan.
---

# Writing Plans

Plans should remove ambiguity, not restate the ticket.

Workflow:

1. Restate the goal and the boundaries of the plan.
2. Map the exact files, modules, tests, and runtime surfaces that matter.
3. Break the work into ordered phases with concrete outputs.
4. Call out risks, blockers, migrations, and validation commands for each phase.
5. Keep steps small enough to execute and review cleanly.
6. End with the verification path and the expected handoff: inline execution or delegated execution.

Good plans are specific about where code changes land, what proves the change works, and what must not be changed.
