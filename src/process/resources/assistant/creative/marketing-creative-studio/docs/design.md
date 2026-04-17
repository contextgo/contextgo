# Marketing Creative Studio Preset Design

This document records the design rationale for the built-in `Marketing Creative Studio` assistant preset.

The goal is not to ship another generic design helper. The goal is to make ContextGo's marketing visual workflow durable, traceable, and brand-aware across paid, social, ecommerce, and presales surfaces.

## Why This Should Be A Separate Built-in Package

ContextGo already has built-in visual capability:

- `Design Director` covers product UI direction, visual archetype selection, screenshot critique, design-system distillation, and frontend handoff
- `Morph PPT` covers presentation decks, narrative slides, and animated story flow

But several real business workflows are not product UI design and are not deck output:

- paid ad creatives across networks and aspect ratios
- social media content packs across platforms and locales
- ecommerce selling-point images, banners, and campaign KVs
- presales one-pagers, overview pages, and visual hand-offs
- multi-variant campaigns where the same brief must yield many derived assets

Without a dedicated package, these workflows fragment into:

- ad-hoc image prompts
- inconsistent brand voice and visual language
- platform-spec mistakes that block publishing
- no traceability from a brief back to a final asset

`Marketing Creative Studio` exists to capture this layer as first-party, ContextGo-native automation rather than as a one-off prompt collection.

## Layered Model

The package separates concerns into stable layers:

1. **Brand Context** - normalized inputs about brand identity, tone, banned terms, channel preferences, and visual primitives.
2. **Channel Constraints** - target platform specs, aspect ratios, copy length limits, and legal-safe markers.
3. **Visual Recipe** - the actual asset family: ad creative, social asset, ecommerce surface, KV, one-pager.
4. **Variant Set** - derived outputs grouped by audience, locale, stage, or channel.
5. **Trace Metadata** - brief id, theme id, channel, version, and source linkage.

Each generation flow passes through these layers in order. Skipping a layer is a defect, not a shortcut.

## Differentiation From Design Director

| Concern                                             | Marketing Creative Studio | Design Director               |
| --------------------------------------------------- | ------------------------- | ----------------------------- |
| Paid ad creatives across networks                   | Owned                     | Out of scope                  |
| Social content batches                              | Owned                     | Out of scope                  |
| Ecommerce KV, banner, selling-point images          | Owned                     | Out of scope                  |
| Presales one-pager / overview visuals               | Owned                     | Out of scope                  |
| Product UI design direction                         | Routes back               | Owned                         |
| Screenshot critique                                 | Routes back               | Owned                         |
| Design-system distillation                          | Routes back               | Owned                         |
| Frontend implementation handoff                     | Routes back               | Owned                         |
| Brand identity normalization for marketing surfaces | Owned                     | Co-owned for product surfaces |

If a request mixes product UI design with marketing visual work, the package should split the work and explicitly route the product UI side to Design Director.

## Differentiation From Morph PPT

`Morph PPT` is a slide-narrative and reproducible deck tool. It owns long-form story structure, animation planning, and PPTX output.

`Marketing Creative Studio` does not own slide narratives. When a campaign requires a deck (sales enablement, investor narrative, launch story), the package should route the deck portion to Morph PPT and keep ownership of the static visual asset family.

## Phasing

Phase 1 (initial built-in scope):

- brand context normalizer
- ad creative builder and social asset batch with platform spec checks
- visual-copy pairing
- workspace command seeds for brief, theme, ad creative, social batch, variant set

Phase 2:

- expanded vertical recipes (ecommerce, SaaS, consulting presales, event campaigns)
- richer brand theme packs and reusable asset templates

Phase 3:

- schedule-driven campaign refresh and cross-channel consistency audit
- monitoring of stale assets when source briefs change

The agent package shape, manifest, and skill set should remain stable across phases; later phases are additive.
