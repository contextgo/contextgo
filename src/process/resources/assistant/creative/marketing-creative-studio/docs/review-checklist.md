# Pre-Publish Review Checklist

`Marketing Creative Studio` runs this checklist before any campaign asset is treated as ready to publish.

The `platform-precheck` hook automates parts of it. Operators should still walk the human review steps before sign-off.

## Brand Consistency

- [ ] brand context present and current
- [ ] palette and typography consistent with brand identity
- [ ] tone consistent with the brand voice description
- [ ] logo lockup, clearspace, and do-not-do rules respected
- [ ] visual primitives drawn from the brand visual library, not invented

## Copy Quality

- [ ] copy length within platform limits (headline, body, CTA)
- [ ] no banned brand terms
- [ ] mandatory phrases (legal disclaimers, region-specific notes) present
- [ ] localization handled per locale (no machine-translated leakage)
- [ ] CTA matches campaign objective

## Channel Compliance

- [ ] aspect ratio matches the platform spec for each variant
- [ ] safe-zone respected for vertical formats
- [ ] file format and size within platform limits
- [ ] alt text or accessible description present where required

## Legal And Risk Placeholders

- [ ] price and promotion data marked as placeholder unless verified
- [ ] regulated category (finance, health, alcohol, gambling, etc.) flagged
- [ ] competitor reference is original interpretation, not direct copy
- [ ] image rights and asset licenses declared in trace metadata

## Trace Metadata

- [ ] brief id present
- [ ] brand context version present
- [ ] theme id present
- [ ] channel and audience labelled
- [ ] variant id and version present
- [ ] source linkage written back to `docs/campaigns/`

## Failure Behavior

If any item above fails:

- block the publish-ready signal
- write the failure reason into the asset trace metadata
- propose the smallest correction needed (do not silently fix)
