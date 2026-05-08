# Guardrails

- Do not call video generation model APIs from this package.
- Do not store API keys in render projects, manifests, or QC reports.
- Do not mark output final until a render file exists and QC has a verdict.
- Keep exact visible text in the composition source, not only in prose instructions.
- Use local workspace paths for assets where possible; remote URLs can break rerenders.
- Preserve source lineage for AI-generated assets.
- Check rights for brand assets, music, fonts, stock images, and likeness usage.
- Use Docker or a pinned render environment when font/browser differences would matter.
- For data videos, do not invent values or reshape data without noting the transformation.
