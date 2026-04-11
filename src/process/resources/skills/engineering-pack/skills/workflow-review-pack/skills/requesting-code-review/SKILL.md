---
name: requesting-code-review
description: Use before merging, after major tasks, or whenever a second-pass review should catch bugs, regressions, and missing validation.
---

# Requesting Code Review

Review is part of delivery, not post-processing.

Workflow:

1. Define the review scope precisely: feature, patch, task, or diff range.
2. State the expected behavior, constraints, and known risk areas.
3. Ask the reviewer to prioritize correctness, regressions, edge cases, and missing tests.
4. Use review checkpoints early enough that fixes stay cheap.
5. Feed review results into `receiving-code-review` rather than applying them blindly.

The best review requests are specific about what changed and what must remain true.
