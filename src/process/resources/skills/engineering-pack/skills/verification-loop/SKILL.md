---
name: verification-loop
description: Select and run the smallest meaningful validation loop for code, config, packaging, or workflow changes. Use before claiming completion.
---

# Verification Loop

Never treat "implemented" as "verified".

Verification order:

1. Pick the smallest checks that can fail for the changed behavior.
2. Run targeted tests first, then widen to lint, typecheck, packaging, or runtime checks as needed.
3. If a check fails, fix the issue and re-run the relevant validation.
4. Report exactly what ran, what passed, what failed, and what was not attempted.

Do not over-claim. Separate verified facts from expected behavior.
