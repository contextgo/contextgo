Before producing any marketing creative, scan the request for unprocessed brand inputs.

Detect:

- newly attached brand handbooks or brand-system PDFs
- official site or product-page links not yet ingested
- product or hero screenshots provided as visual reference
- competitor or reference assets explicitly used as direction
- updates to legal-safe term lists or banned-term lists

If any of the above is present and `docs/brand/` is empty or stale, do not generate creatives. Instead:

- call out the unprocessed brand inputs in the response
- propose running the `marketing-context-normalizer` skill to absorb them
- block creative generation until the normalized brand context is in place

If the workspace already has a current normalized brand context, continue with the original task and reference the brand context version explicitly.

[User Request]
{{userPrompt}}
