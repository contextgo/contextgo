# Content Submission Flow

This document describes how public docs and blog content reach `contextgo-releases`.

## Principle

Do not edit `site/` content by hand in this repository unless there is an emergency repair.

Normal publishing flow should always start from the private source repository, where:

- MDX source files live in `apps/web/src/content/`
- website rendering logic lives in `apps/web/`
- export scripts live in `scripts/release/`

The release pipeline then exports structured payloads into this repository.

## Normal Flow

1. Update docs or blog source in the private source repository.
2. Verify website rendering locally.
3. Run the release content export as part of the release workflow.
4. Let automation publish updated files into this repository.

## Exported Structure

The pipeline writes:

- `site/docs/latest.json`
- `site/docs/versions.json`
- `site/docs/<version>/<locale>/index.json`
- `site/docs/<version>/<locale>/<slug>/article.json`
- `site/docs/<version>/<locale>/<slug>/source.mdx`
- `site/blog/<locale>/index.json`
- `site/blog/<locale>/<slug>/article.json`
- `site/blog/<locale>/<slug>/source.mdx`

## When Manual Edits Are Acceptable

Manual edits here should be rare and limited to:

- fixing a broken README or repository-facing explanation
- emergency correction of a malformed exported file when the source repository cannot be rerun immediately
- operational metadata fixes around a specific public release

If a manual edit changes public docs or blog content, the same fix should be applied back to the private source repository immediately after.

## Review Standard

Before merging a public-content change, confirm:

- the change belongs on the public website
- no private implementation detail is exposed
- article source and rendered payload still describe the same content
- docs changes that should be versioned are published through the release flow
- blog changes are intentional current-site content, not release-history metadata

## Emergency Rule

If `site/` is patched directly in this repository during an incident, treat that as a temporary repair.

The permanent fix must still be committed in the private source repository so the next export does not overwrite the manual patch.
