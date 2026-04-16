---
name: diff-minimization-review
description: Review the final diff for unnecessary scope, overengineering, and weak verification. Use before claiming completion or opening a PR.
---

# Diff Minimization Review

Inspect the final change as if you were the reviewer trying to cut scope back to the request.

## Review Questions

- Which changed lines are strictly required for the requested behavior?
- Did any helper, abstraction, or refactor appear without a real current need?
- Did the diff alter comments, formatting, or nearby code unnecessarily?
- Is the verification evidence strong enough for the claim being made?

## Output

- Required change set
- Suspected overreach
- Verification gaps
