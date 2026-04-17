---
name: marketing-context-normalizer
description: Normalize raw brand and campaign inputs into a stable brand context object before any creative is generated.
compatibility:
  - 'Use before any other Marketing Creative Studio skill when the workspace lacks a current normalized brand context.'
  - 'Use when a new brand handbook, official site link, product page screenshot, or competitor reference appears in the workspace.'
---

# Marketing Context Normalizer

Use this skill to normalize raw brand and campaign inputs into a stable brand context object that downstream skills can consume.

Read `../../references/platform-specs.md` and `../../references/channel-tone.md` for shared defaults before deciding the brand context shape.

## Use when

- The workspace does not yet have a normalized brand context in `docs/brand/`.
- A new brand handbook, official site link, product page screenshot, or competitor reference has appeared.
- A campaign brief depends on brand context that the operator has not yet captured.
- Banned-term lists, mandatory phrases, or compliance markers have changed.

## Do not use when

- The workspace already has a current brand context and the source inputs are unchanged.
- The request is a narrow asset tweak that does not depend on brand identity.
- The task is product UI design, screenshot critique, or design-system work (route to `Design Director`).

## Failures to avoid

- inventing brand identity, palette, typography, or motif from chat-only inputs
- copying competitor brand identity literally
- skipping the channel preference and banned-term sections
- treating a single screenshot as authoritative brand source

## Workflow

### 1. Inventory the inputs

List every source the operator has provided:

- official brand materials
- official site or product-page links
- product or hero screenshots
- competitor or reference assets
- channel handle screenshots
- legal-safe term lists or banned-term lists

If the inventory is empty, stop and ask the operator for at least one authoritative brand source.

### 2. Categorize each input

For each input, decide whether it is:

- authoritative brand source (handbook, official site, internal brand-system export)
- supportive brand signal (handle screenshot, prior published asset)
- reference direction (competitor or external aspirational asset)

Reference direction must never be promoted to authoritative source.

### 3. Distill the brand context

Produce a normalized brand context with these stable sections:

- identity (brand name, voice, tone dimensions, palette with semantic roles, typography stack, logo lockups, do-not-do rules)
- channel preferences (ranked channels, per-channel formatting, locale defaults)
- copy rules (voice description, vocabulary, banned terms, mandatory phrases, localization expectations)
- visual primitives (photographic vs illustrative direction, motif library, imagery do-not-do rules)
- compliance and risk markers (regulated category flags, mandatory disclaimers, license notes)

### 4. Write back to the workspace

When a workspace is linked, write the normalized context into:

- `docs/brand/context.md`
- `docs/brand/banned-terms.md`
- `docs/brand/channel-preferences.md`
- `docs/brand/visual-primitives.md`

Stamp every file with a brand context version so downstream skills can reference it.

### 5. Surface unresolved gaps

End with an explicit list of:

- inputs that did not fit any category
- areas where the brand context still has assumed values
- references the operator should provide for the next normalization pass

## Output format

Return:

### 1. Input inventory

- per-source category and authority level

### 2. Normalized brand context

- identity
- channel preferences
- copy rules
- visual primitives
- compliance and risk markers
- brand context version

### 3. Workspace write-back plan

- the files to write or update
- the diff or summary for each file

### 4. Unresolved gaps

- inputs that were ignored and why
- assumed values that need confirmation

## Use together with

- `brand-theme-pack`
- `ad-creative-builder`
- `social-asset-batch`
- `visual-copy-pairing`
- `campaign-variant-generator`
