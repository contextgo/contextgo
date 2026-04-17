# Scenes

This directory holds project-specific scene recipes that extend the package's default scene model.

Each recipe should declare:

- `recipeId`
- `defaultDurationFrames`
- `composition`
- `motionTokens`
- `transitionDefaults`
- `captionDefaults`

Promote a scene to a recipe when the same composition recurs across more than one storyboard.
