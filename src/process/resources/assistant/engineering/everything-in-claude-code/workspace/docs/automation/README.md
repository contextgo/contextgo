# Workspace Automation

Use this document when the task touches schedules, loops, periodic jobs, or continuous workflows.

## What Automation Means Here

- This package may express automation through schedules, loop-oriented workflows, and ongoing observation or learning flows.
- These are platform automation capabilities, not facts the agent should always keep in working memory.
- Installed schedule state lives in `.contextgo/schedules.json`.

## Open This Doc When

- deciding whether a workflow should run once, on a schedule, or as a continuous loop
- translating upstream ECC loop concepts into ContextGo-native automation
- auditing or debugging workspace automation behavior
- documenting long-running or periodic workflows in a linked workspace

## Modeling Guidance

- Use `automation` as the umbrella concept for schedules, loops, periodic jobs, and continuous workflows.
- Treat loops as one automation pattern, not as the product boundary.
- Keep execution semantics in package payloads and installed workspace state, then use docs to explain how to work with that automation.
