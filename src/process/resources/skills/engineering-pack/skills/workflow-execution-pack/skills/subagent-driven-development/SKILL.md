---
name: subagent-driven-development
description: Use when a written plan should be executed through delegated workstreams, but only when the runtime supports subagents and the user wants that mode.
---

# Subagent-Driven Development

Delegate with boundaries, not vibes.

Workflow:

1. Confirm the runtime supports delegation and the user wants subagent-style execution.
2. Keep the immediate blocking task local; delegate independent or clearly bounded follow-on work.
3. Give each delegated stream explicit ownership, files, constraints, and expected verification.
4. Review each returned result before integrating it into the main branch of work.
5. Request review between major tasks so mistakes do not compound.
6. Finish with the same close-out discipline as inline work: verification and branch wrap-up.

If the runtime cannot safely delegate, fall back to `executing-plans`.
