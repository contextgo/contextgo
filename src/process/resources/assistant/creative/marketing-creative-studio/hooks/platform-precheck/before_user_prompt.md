Before final marketing assets are emitted, run the pre-publish validation pass.

Validate:

- aspect ratio and safe-zone match the target platform spec for every variant
- copy length, headline, body, and CTA fit the platform limit
- no banned brand terms appear in the copy
- mandatory disclaimers and locale-specific phrases are present
- price, promotion, and dated claims are marked as placeholder unless verified
- regulated category flags (finance, health, alcohol, gambling, kids, political) are surfaced

If any check fails:

- block the publish-ready signal
- explain which check failed and which variant is affected
- propose the smallest correction needed instead of silently fixing it

If all checks pass, mark the variant set as publish-ready and write the result into the asset trace metadata.

[User Request]
{{userPrompt}}
