# ContextGo Google Drive Sidecar Stub

This is the minimal Go sidecar stub for the `google-drive` connector.

Current scope:

- parse OAuth client flags
- hold a long-lived process contract for ContextGo-managed sidecar execution
- expose a `--once` mode for quick validation in development

This stub does **not** implement the real Google Drive OAuth or API flow yet.
That is the next step after the runtime contract is stabilized.
