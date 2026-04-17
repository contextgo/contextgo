---
name: deck-theme-apply
description: Apply or refresh a visual theme on an existing artifact spec without changing its layout recipe or content structure.
compatibility:
  - 'Works best when the artifact already has a recipe and content structure.'
  - 'Requires either a theme id from the package theme catalog or an inline theme spec.'
---

# Deck Theme Apply

Use this skill when an artifact spec already exists and the user wants to apply
or refresh its visual theme without changing the underlying recipe or content.

Read `../../docs/layout-recipes.md`, `../../docs/export-modes.md`, and
`../../docs/quality-checks.md` before applying.

## Use when

- The user wants to re-skin a deck, PDF, or infographic with a different theme.
- The user wants to align an artifact with the canonical theme catalog.
- A QC sweep has flagged theme drift on an existing artifact.

## Do not use when

- The artifact does not yet have a recipe or content structure (run a
  generation skill first).
- The user wants to change the underlying recipe (run the appropriate
  generation skill).

## Workflow

### 1. Validate the existing spec

Confirm that the spec carries a recipe id, a content structure, and any prior
theme metadata. Refuse to apply a theme to an unstructured spec.

### 2. Resolve the new theme

Resolve a theme id from the package theme catalog or an inline theme spec.
Resolve every theme token before touching the spec.

### 3. Apply tokens

Replace palette, typography, surface, motion, and spacing tokens. Preserve all
content and recipe slots untouched.

### 4. Re-run QC

Run the pre-export checks from `../../docs/quality-checks.md`. Theme changes can
trigger new contrast, overflow, or font fallback failures.

### 5. Re-export

Re-run the same export mode that the spec last used. Update `build-notes.md`,
`assets.json`, and `failures.json`. Mark the change as a theme refresh.

## Output

- a re-themed artifact in the original export mode
- an updated build note that records the prior theme id, the new theme id, and
  any QC findings introduced by the theme change
