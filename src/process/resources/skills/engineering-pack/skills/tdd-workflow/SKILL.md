---
name: tdd-workflow
description: Use when implementing features, fixing bugs, or refactoring behavior. Anchor the change in a failing repro, test update, or explicit executable contract before broad implementation.
---

# TDD Workflow

Treat evidence as part of the task.

Preferred loop:

1. Define the expected behavior, bug repro, or contract.
2. Add or update the smallest meaningful failing test first when practical.
3. Implement the minimum change needed to make the test pass.
4. Refactor only after the behavior is protected.
5. Re-run the targeted test, then the next wider validation layer.

If tests cannot be added or executed, say exactly what remains unverified.
