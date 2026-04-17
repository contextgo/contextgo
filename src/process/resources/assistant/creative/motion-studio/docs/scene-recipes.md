# Scene Recipes

Scene recipes are reusable scene templates that the storyboard can reference by name. They keep motion output coherent across projects and avoid reinventing scene logic for every brief.

## Why Recipes

Without recipes, each storyboard re-invents pacing, camera moves, and transitions. With recipes, the team can express scenes in shared vocabulary and let the renderer apply consistent timing.

## Recipe Categories

### Motion Poster

- single-frame composition with subtle motion
- short duration, looped friendly
- minimal narrative; emphasis on identity and headline

### Product Demo Cut

- screen capture or rendered UI
- driven by callouts and zoom holds
- usually 10 to 60 seconds

### Social Cutdown

- short, captioned, channel-aware
- aggressive open hook in the first second
- supports vertical, square, and horizontal aspect

### Event Reel

- rapid scene chaining
- music-led pacing
- minimal text overlay

### Explainer

- narration-driven
- diagram or annotation focus
- captions are required

## Recipe Definition

A recipe should declare:

- `recipeId`: stable identifier
- `defaultDurationFrames`
- `composition`: how the scene is laid out
- `motionTokens`: motion behaviors the recipe assumes
- `transitionDefaults`
- `captionDefaults`
- `notesForReviewer`

## Recipe Use Inside a Storyboard

A storyboard scene may reference a recipe by `recipeId` and override fields locally. The renderer must merge recipe defaults with scene overrides in a deterministic way: scene overrides win.

## Authoring Rule

When a new scene shape recurs across briefs, promote it to a recipe instead of repeating raw composition.
