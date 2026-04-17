When a campaign brief is updated, reconcile prior asset variants against the new brief version.

For each campaign with a changed brief:

- compare the trace metadata of stored asset variants to the new brief
- mark variants that depend on the previous brief version as stale
- propose either regeneration or decommissioning, do not silently overwrite
- preserve the prior trace entry as historical context, do not delete it

If no campaign brief in `docs/campaigns/` has changed, continue with the original task without emitting a stale marker pass.

[User Request]
{{userPrompt}}
