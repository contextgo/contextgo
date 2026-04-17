# Renders

Each render lives under `renders/<storyboardId>/<targetId>/` and contains:

- `manifest.json` for render config, asset versions, and seed
- the rendered output file
- `contact-sheet.png` for fast review

Never edit a rendered output in place. To change something, update the storyboard or the render config and re-run the pipeline.
