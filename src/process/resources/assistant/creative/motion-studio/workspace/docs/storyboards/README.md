# Storyboards

Each storyboard lives under `storyboards/<storyboardId>/` and contains:

- `storyboard.json` validated against the storyboard contract
- `script.md` for the narrative source
- optional `notes.md` for reviewer context

When updating a storyboard, increment its `version` field. Major changes to scene order, scene intent, or target list increment the major version.
