# Drift Reports

Use this folder to keep drift reports produced by `figma-drift-audit`.

For each drift report, record:

- audit timestamp, scope, and reviewer
- structured drift table with surface, direction, severity, and remediation track
- the remediation plan grouped as auto-syncable, review-required, frozen
- which items, if not addressed, are most likely to cause user-visible inconsistencies
- the link from each remediation item back to the Figma file key, node id, and code path

Items marked `frozen` must stay frozen across reports until a human explicitly unfreezes them.
