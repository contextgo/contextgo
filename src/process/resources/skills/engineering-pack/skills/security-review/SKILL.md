---
name: security-review
description: Review trust boundaries, secret handling, shell execution, filesystem access, auth paths, and remote-control risk. Use for security-sensitive code or workflow changes.
---

# Security Review

Focus on high-consequence mistakes first.

Check for:

- secret leakage in prompts, logs, config, or test fixtures
- command injection, path traversal, unsafe shell composition
- missing auth or authorization checks
- overbroad remote-access, upload, or IPC trust
- unsafe MCP exposure, default-open integrations, or hidden network assumptions
- user-controlled data flowing into privileged actions

Prefer narrowly scoped evidence and concrete mitigation steps.
