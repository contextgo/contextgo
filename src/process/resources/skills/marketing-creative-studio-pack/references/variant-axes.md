# Variant Axes

Canonical axes used to expand a campaign brief into a variant set. Skills pick the relevant axes based on the campaign scope.

## Size

- per-platform aspect ratios (1:1, 4:5, 9:16, 16:9, 1.91:1, 5:6)
- per-platform variants for hero, feed, story, banner

## Locale

- locale codes from the brand context
- per-locale copy variants
- per-locale compliance phrases

## Audience

- segment slug from the campaign brief
- segment-specific value proposition framing
- segment-specific CTA where supported

## Stage

- awareness, consideration, conversion, retention
- per-stage messaging hierarchy and CTA

## Channel

- specific channel id within a platform group
- per-channel placement (feed, story, search, in-app)

## Theme

- seasonal or campaign theme overlay
- theme delta (palette, motif, tone shift) layered on the brand context

## Stage-Of-Life

- new launch, evergreen, refresh, decommission
- influences whether to generate, refresh, or stale-mark variants

## Combination Rules

- never multiply all axes blindly
- for each campaign, decide which axes are in scope first
- emit a variant matrix that documents the chosen axes
