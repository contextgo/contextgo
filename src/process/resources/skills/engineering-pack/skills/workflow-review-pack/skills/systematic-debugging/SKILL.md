---
name: systematic-debugging
description: Use for failures, regressions, flaky tests, and unexpected behavior before proposing fixes.
---

# Systematic Debugging

Root cause first.

Workflow:

1. Reproduce the issue and capture the exact evidence: error, logs, inputs, environment.
2. Read the failure carefully before changing anything.
3. Trace the data flow backward to find where reality diverges from expectation.
4. Compare against known-good paths, recent changes, or working references.
5. Form one concrete hypothesis and test it with the smallest meaningful experiment.
6. Only implement a fix after the root cause is identified, then verify the fix and nearby regressions.

If multiple speculative fixes have already failed, stop thrashing and question the design assumptions.
