---
name: code-review-workflow
description: Review code for correctness, regressions, maintainability, and missing tests. Use when the user asks for review or when a large implementation needs a quality pass before delivery.
---

# Code Review Workflow

Review changed behavior, not just edited lines.

Checklist:

1. Inspect the diff and read the surrounding implementation.
2. Prioritize correctness, security, regressions, and verification gaps.
3. Ignore low-signal style comments unless they violate project rules.
4. Report findings first, ordered by severity.
5. Include file references, likely impact, and the fix direction.

If no real issues are found, state that explicitly and mention residual risk.
