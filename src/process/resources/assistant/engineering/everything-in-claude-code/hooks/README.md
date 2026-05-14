# ECC Hook Payload

This directory stores absorbed hook payload and manifests for the ECC package.

Package-level explanation moved to:

- `../docs/hooks.md`

Keep this directory focused on hook payload, not on long-form package documentation.

## Cross-Platform Notes

Hook logic is implemented in Node.js scripts for cross-platform behavior on Windows, macOS, and Linux. A small number of shell wrappers are retained for continuous-learning observer hooks; those wrappers are profile-gated and have Windows-safe fallback behavior.

## Related

- [rules/common/hooks.md](../rules/common/hooks.md) — Hook architecture guidelines
- [skills/strategic-compact/](../skills/strategic-compact/) — Strategic compaction skill
- [scripts/hooks/](../scripts/hooks/) — Hook script implementations
