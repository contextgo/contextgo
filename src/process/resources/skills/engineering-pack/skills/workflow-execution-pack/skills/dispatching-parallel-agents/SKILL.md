---
name: dispatching-parallel-agents
description: Use when multiple independent investigations or implementation streams can progress in parallel without conflicting ownership.
---

# Dispatching Parallel Agents

Parallelism only helps when the work is actually separable.

Workflow:

1. Split the problem into independent workstreams with disjoint ownership.
2. Keep shared files, shared state, and integration-critical work on the main path.
3. Give each delegated stream the exact question or write scope it owns.
4. Avoid duplicate exploration across agents.
5. Integrate only after reviewing outputs for conflicts and verifying the combined result.
6. If the workstreams are coupled or the runtime does not support delegation, do not force parallelism.

Use this for speed on independent slices, not as a substitute for thinking through dependencies.
