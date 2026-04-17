# Vertical Recipes

Reference table for default vertical recipes used by marketing creative skills.

## Ecommerce

- default surfaces: PDP hero, listing card, promotion banner, selling-point image stack, paid social ads, email header
- price/promotion always placeholder until verified
- localization typically multi-locale by default
- variant breakdowns: per-SKU, per-region, per-promotion period

## SaaS

- default surfaces: announcement KV, in-app banner placeholder, paid ads, email header, sales one-pager
- pricing tier copy is structured input, not free text
- proof points sourced from `docs/brand/`
- variant breakdowns: per-segment, per-pricing-tier, per-region

## Consulting Presales

- default surfaces: one-pager, account-specific KV, webinar / event KV, deck cover (deck body routed to Morph PPT)
- account branding may coexist with delivery brand identity
- proof points typically case-study driven; cite sources from `docs/brand/`

## Event Campaigns

- default surfaces: event KV, session card variants, speaker card set, in-venue signage placeholders, post-event recap KV
- date and venue treated as placeholder until verified
- accessibility honored in size and contrast
- variant breakdowns: per-track, per-format (in-person, virtual), per-region

## Recipe Selection Rule

If the request matches a vertical, prefer the vertical recipe over a generic asset recipe. Document which recipe was chosen and why in the campaign trace metadata.
