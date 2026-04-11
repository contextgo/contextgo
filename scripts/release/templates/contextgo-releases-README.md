# ContextGo Releases

This repository is the public distribution endpoint for ContextGo.

It is intentionally separate from the private product source repository. The goal is simple:

- keep installers, manifests, checksums, and GitHub Releases public
- keep customer-facing website content available in a stable, website-readable structure
- avoid exposing private source code, internal docs, or unfinished implementation details

## What Lives Here

- GitHub Releases and attached installable artifacts
- release metadata consumed by the desktop updater and download center
- public website content exported under `site/`

## What Does Not Live Here

- private product source code
- internal engineering plans or design notes
- manually curated website builds

## Public Site Content

The website reads structured content from `site/`.

- `site/docs/` stores versioned documentation payloads
- `site/blog/` stores current blog payloads
- each article directory includes both:
  - `article.json` for website rendering
  - `source.mdx` for repository-readable source content

See `docs/content-submission.md` for the content submission flow.

## Source Of Truth

ContextGo release truth is split by responsibility:

- private source repository:
  - app code
  - website code
  - MDX content source
  - release automation
- this repository:
  - public artifacts
  - public manifests
  - public release history
  - exported public docs/blog payloads

The website should consume release metadata or exported content from this repository, not re-invent a second source of truth.
