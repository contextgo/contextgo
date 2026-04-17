---
name: surgical-change
description: Keep edits tightly scoped to the request. Use when changing existing code so the diff stays traceable to the task.
---

# Surgical Change

Every changed line should trace directly to the current request.

## Rules

- Edit only the files and code paths needed for the task.
- Do not reformat, rename, or refactor adjacent code just because you noticed it.
- Clean up only the imports, variables, or branches that your current change made obsolete.
- If you find unrelated dead code or design debt, note it instead of deleting it.

## Final Check

- Would this diff be easier to review if it were smaller?
- Is any file changed only because it was nearby?
- Did I change behavior outside the requested path?
