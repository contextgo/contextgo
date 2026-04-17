# Industry Vertical Templates

This document captures vertical templates that `Marketing Creative Studio` should match against before falling back to generic recipes.

The goal is to keep vertical knowledge as recipes rather than as one-off prompts.

## Ecommerce

Use when the campaign is anchored on a product catalog, promotion, or activity page.

Default surfaces:

- product detail page hero KV
- listing card hero
- promotion or activity banner (web and mobile)
- selling-point image stack (PDP module)
- paid social ads tied to the catalog
- email header for promotional sends

Vertical conventions:

- price and promotion always treated as placeholder until verified
- compliance disclaimers required for regulated categories
- localization expectations: typically multi-locale even for a single brief
- variant breakdowns: per-SKU, per-region, per-promotion period

## SaaS

Use when the campaign is anchored on a product launch, feature push, or pricing change.

Default surfaces:

- announcement KV (web hero, social, blog header)
- in-app banner placeholder
- paid ads for acquisition channels
- email header for activation or upsell sends
- one-pager for sales enablement

Vertical conventions:

- pricing tier copy treated as structured input, not free text
- proof points (logos, metrics, quotes) must be sourced from `docs/brand/`
- product naming must respect product-name brand guardrails
- variant breakdowns: per-segment, per-pricing-tier, per-region

## Consulting Presales

Use when the campaign supports a presales motion or proposal package.

Default surfaces:

- one-pager overview
- account-specific KV for proposal cover
- webinar or event KV for thought leadership
- sales enablement deck cover (route deck body to Morph PPT)

Vertical conventions:

- deal-specific data treated as confidential placeholder
- account branding may need to coexist with delivery brand identity
- proof points typically case-study driven; cite sources from `docs/brand/`

## Event Campaigns

Use when the campaign supports a live event, hybrid event, webinar, or activation.

Default surfaces:

- hero event KV
- session card variants
- speaker card set
- in-venue signage placeholders
- post-event recap KV

Vertical conventions:

- date and venue treated as placeholder until verified
- accessibility requirements must be honored in size and contrast
- localization typically required for multi-region events
- variant breakdowns: per-track, per-format (in-person, virtual), per-region

## Adding A New Vertical

To add a new vertical:

1. document the default surface set
2. document the vertical conventions and placeholders
3. add a recipe selector hint in `asset-recipes.md`
4. update the `industry-templates.md` entry above

Do not let vertical knowledge live only inside chat history.
