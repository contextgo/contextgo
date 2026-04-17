---
name: assumption-audit
description: Audit ambiguity, hidden assumptions, and missing constraints before writing code. Use when a coding task could be interpreted more than one way.
---

# Assumption Audit

Before coding:

- restate the task in concrete terms
- list what is explicitly known
- name what is inferred rather than specified
- identify any ambiguity that would materially change the implementation

## Rules

- Do not silently pick one interpretation if multiple plausible readings exist.
- If the ambiguity changes APIs, data flow, file scope, or verification, surface it.
- If the task is still safe to proceed under a narrow assumption, state that assumption explicitly.

## Output

- Known facts
- Active assumptions
- Clarification needed or safe narrow assumption
