---
name: simplicity-first
description: Constrain implementation to the minimum code and abstraction required. Use when coding work risks drifting into speculative architecture.
---

# Simplicity First

Choose the smallest implementation that fully solves the task.

## Rules

- No abstraction for a single use without a demonstrated need.
- No configurability that the task did not ask for.
- No defensive branches for scenarios the surrounding code cannot reach.
- If the same behavior can be delivered with fewer moving parts, prefer that version.

## Self-Check

Ask:

- Can this be solved with less code?
- Did I introduce an abstraction only one caller uses?
- Did I add flexibility for a future that the task never requested?
