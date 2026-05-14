# Marketing Creative Studio Package Notes

This package contains the built-in marketing creative assistant and its package-level guidance.

## Main Purpose

Marketing Creative Studio exists to keep brand, growth, ecommerce, and presales visual work from collapsing into ad-hoc prompt requests.

The package is optimized for:

- normalizing campaign briefs and brand inputs into a stable creative context
- pairing visual direction with channel-aware copy
- producing batches of ad creatives, social assets, and ecommerce surfaces in correct platform specs
- generating consistent variant sets for a single campaign across sizes, locales, and stages
- vertical recipes for ecommerce, SaaS, presales, and event campaigns

## Package Surfaces

- `AGENTS.md`
  - runtime-facing rules entry document
- `docs/design.md` and `docs/design.zh-CN.md`
  - longer package design rationale and rationale for separation from Design Director
- `docs/brand-inputs.md`
  - what counts as a brand input, how to normalize it, where to store it
- `docs/campaign-workflows.md`
  - end-to-end campaign brief to multi-channel asset workflow
- `docs/asset-recipes.md`
  - recipes for ad creatives, social batches, ecommerce surfaces, and event KVs
- `docs/review-checklist.md`
  - pre-publish checklist for brand, platform, and legal-safe output
- `docs/industry-templates.md`
  - vertical templates: ecommerce, SaaS, consulting presales, event campaigns
- `docs/guardrails.md`
  - brand-banned word handling, platform spec validation, stale asset behavior
- package root
  - `src/process/resources/assistant/creative/marketing-creative-studio`
- skill source
  - `src/process/resources/skills/marketing-creative-studio-pack`
- bundled marketing creative skills
  - marketing context normalizer
  - brand theme pack
  - ad creative builder
  - social asset batch
  - visual copy pairing
  - campaign variant generator

## Stable Package Behaviors

This package should continue to:

- separate brand context, channel constraints, and visual recipe layers
- treat each asset as a campaign-traced object with brief, theme, channel, and version metadata
- never produce final assets until brand context and platform specs are explicit
- prefer batch generation that respects platform aspect ratios, copy length, and locale variants
- keep ContextGo-native automation (commands, hooks, schedules) inside `.contextgo/` rather than projecting them into runtime-native directories

## Workspace Commands

This package seeds commands such as:

- `campaign-brief`
- `brand-theme`
- `generate-ad-creative`
- `generate-social-batch`
- `generate-variant-set`

## Workspace Hooks

This package contributes hook seeds for:

- `brand-input-watcher` - prompts the operator to normalize a brand context when brand kits, official site links, product page screenshots, or competitor visuals appear
- `platform-precheck` - runs platform spec, copy-length, brand-banned-term, and legal-risk placeholder checks before assets are emitted
- `campaign-stale-marker` - marks prior asset variants as stale when the source campaign brief is updated

## Workspace Schedules

This package seeds workspace-level schedules to keep campaigns durable:

- weekly social content pack drafting
- monthly brand consistency audit across active campaigns
- variant refresh for evergreen campaigns on a defined cadence

## Installation Surfaces

- `.contextgo/skills`
  - installs the marketing creative skills declared by the preset package
- `.contextgo/commands.json`
  - seeded through the `marketing-creative-studio` workspace automation profile
- `.contextgo/schedules.json`
  - seeded through the `marketing-creative-studio` workspace automation profile
- `.contextgo/hooks/` and `.contextgo/hooks.json`
  - seeded from package-relative hook payload
- runtime-native directories
  - only receive projected skills when the runtime expects its own native skill directory

## Authoring Rule

Keep runtime persona rules in `AGENTS.md`, package-level notes in `docs/`, and executable workflows in the packaged skills.

## Migration Status

The package root owns:

- the runtime-facing assistant entry
- the short packaged rules entry in `AGENTS.md`
- the deeper package design material in `docs/`

The executable skill payload is sourced from `src/process/resources/skills/marketing-creative-studio-pack`.

That split is acceptable as long as `.contextgo/` remains the installation source of truth and the runtime only receives projected skills.
