---
name: social-asset-batch
description: Generate organic social asset batches (feed, story, reel, carousel, short) sized per platform and toned per channel.
compatibility:
  - 'Use when the operator needs organic social assets for Instagram, TikTok, X, LinkedIn, or YouTube shorts.'
  - 'Use after brand-theme-pack so the batch shares one visual system across platforms.'
---

# Social Asset Batch

Use this skill to generate organic social asset batches: feed posts, stories, reels, carousels, and shorts sized per platform and toned per channel. The output is a structured batch that downstream review and publish handoff can consume.

Read `../../references/platform-specs.md` and `../../references/channel-tone.md` before producing batches. Read `../../references/variant-axes.md` before deciding the batch matrix.

## Use when

- The operator needs organic posts across Instagram, TikTok, X, LinkedIn, or YouTube shorts.
- The operator needs a multi-day or campaign-aligned content batch.
- The operator needs carousel sequences, story sequences, or short-form vertical videos that must respect platform tone.

## Do not use when

- The brand context or theme pack is not yet ready (route to `marketing-context-normalizer` then `brand-theme-pack`).
- The request is a paid-ad placement (route to `ad-creative-builder`).
- The request is a structured visual + copy pairing as a deliverable (route to `visual-copy-pairing`).
- The request is product UI mocks (route to `Design Director`).

## Failures to avoid

- producing identical copy across platforms instead of honoring per-channel tone
- ignoring vertical or square aspect requirements for stories, reels, and shorts
- exceeding platform copy limits
- using motifs not present in the theme pack
- forcing trend references that do not fit the brand voice

## Workflow

### 1. Confirm inputs

Verify these inputs are present:

- normalized brand context
- brand theme pack id and version
- campaign brief or post brief (objective, key message, hashtag policy, mandatory phrases, banned terms)
- target channels and post count per channel
- locale list

If any input is missing, stop and request it.

### 2. Decide the batch matrix

Use `../../references/variant-axes.md` to pick which axes are in scope. Typical organic batch axes:

- channel (per-platform tone and format)
- size (per-platform aspect ratio)
- locale (per-locale copy)
- stage-of-life (launch, evergreen, refresh)

Document the chosen axes and the post count per channel.

### 3. Plan per-channel format

For each channel, look up the spec from `../../references/platform-specs.md` and the tone from `../../references/channel-tone.md`. Produce a format plan that lists:

- aspect ratio
- copy / caption limit
- format type (single, carousel, story sequence, reel, short)
- tone summary

### 4. Generate post variants

For each post, produce:

- a hook (first frame for vertical formats, headline for static)
- caption within the platform limit
- hashtag block following the brief policy
- visual direction grounded in theme pack motifs
- alt text for accessibility

For carousels and story sequences, produce per-card content with a clear narrative arc.

### 5. Sequence the batch

Order the batch by:

- platform priority from the brand context channel preferences
- stage progression where applicable (launch then proof then objection-handling)

### 6. Write back to the workspace

When a workspace is linked, write the batch into:

- `docs/campaigns/<campaign-id>/social/matrix.md`
- `docs/campaigns/<campaign-id>/social/<channel-id>.md` (one per channel)

Stamp every file with the brand context version, theme pack version, and brief version.

### 7. Flag review gates

End with explicit review gates:

- copy needing proof or substantiation
- compliance overlays for regulated categories
- placeholder values needing operator confirmation

## Output format

Return:

### 1. Inputs confirmed

- brand context version, theme pack version, brief version

### 2. Batch matrix

- chosen axes
- per-channel post count

### 3. Format plan

- per-channel spec and tone summary

### 4. Post variants

- per-post hook, caption, hashtags, visual direction, alt text

### 5. Workspace write-back plan

- the files to write or update
- the diff or summary for each file

### 6. Review gates

- copy needing proof
- compliance overlays needing legal review
- placeholders needing confirmation

## Use together with

- `marketing-context-normalizer`
- `brand-theme-pack`
- `ad-creative-builder`
- `visual-copy-pairing`
- `campaign-variant-generator`
