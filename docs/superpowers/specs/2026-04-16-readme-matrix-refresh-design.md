# README Matrix Refresh Design

## Goal

Rewrite the public README surfaces for the four ContextGo repositories so they present one coherent product story:

- `contextgo` is the main product and brand entry point
- `connector`, `skillmarket`, and `contextgo-releases` are product-matrix subprojects
- Chinese becomes the primary root README language
- English remains fully available through `README_EN.md`

This design intentionally replaces the older "Cowork app" framing, removes outdated GIF-heavy presentation, and aligns the docs with the current product model:

- Harness Agent
- Agent Group
- Context Engine
- Context Connector
- Host / Client
- local-first execution with remote access surfaces

## Audience

Primary audience:

- AI product users
- potential buyers / adopters
- GitHub visitors evaluating what the product is

Secondary audience:

- developers and open-source contributors

The README structure should therefore lead with product value, workflow fit, and use cases, then transition into architecture and repository boundaries.

## Repository Roles

### `contextgo`

The main product repository and canonical brand entry.

It should answer:

- what ContextGo is
- why it exists
- how Agent work is made more stable and useful
- how the full product system fits together
- where to start as a user or developer

### `connector`

The open-source connector and controlled-execution boundary for ContextGo.

It should answer:

- what a Context Connector is
- why external tools, products, browser surfaces, and local resources need a dedicated boundary
- how `cgo` fits into ContextGo
- what can be used independently by developers

### `skillmarket`

The open-source skill discovery, mirroring, curation, and distribution infrastructure for ContextGo.

It should answer:

- why Agent skills need a market / catalog layer
- how upstream mirrors, curated bundles, and static market output fit together
- what this repository provides today

### `contextgo-releases`

The public distribution and release-metadata repository.

It should answer:

- why release artifacts live separately from the main product source
- what this repository publishes
- how installers, manifests, updater metadata, and exported public content are consumed

## README Structure Rules

Shared rules across all four repositories:

- Chinese root `README.md`
- English `README_EN.md`
- product-first narrative
- technical details below the product explanation
- fewer unstable marketing claims
- fewer counts that age quickly
- static brand imagery rather than relying on animated demo assets

## Visual Direction

The README visual layer should use one shared ContextGo brand system:

- ContextGo header / banner
- ContextGo logo
- subproject subtitle in text

For subproject repositories, add local copied brand assets so each repo stays self-contained.

## Content Boundaries

This pass will:

- rewrite the eight main README files
- add lightweight brand assets for the three subproject repositories
- preserve existing deep technical docs
- stop using the old README as the narrative source of truth

This pass will not:

- rewrite every existing translated README under `docs/readme/`
- redesign the website
- rewrite unrelated repositories
- reorganize large existing doc trees

## Verification

Before completion:

- confirm local README image paths exist
- confirm cross-repo GitHub links point to the correct repositories
- review markdown for obvious rendering issues
- run `git diff --check` in each touched repository
