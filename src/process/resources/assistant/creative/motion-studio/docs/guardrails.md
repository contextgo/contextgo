# Guardrails

These guardrails apply to every Motion Studio workflow. They define hard execution boundaries that should not be relaxed by individual skills.

## Storyboard-First

- never start a render without a validated storyboard
- never collapse storyboard creation into the renderer
- never let the renderer silently invent new scenes that are not in the storyboard

## Reproducibility

- every render must persist its render config alongside the output
- every render must reference the storyboard version, recipe versions, and asset versions
- random behavior is allowed only through the explicit `seed` field
- the same render config and the same inputs must produce the same output

## Asset Discipline

- referenced assets must resolve to a real workspace path
- assets must declare their license suitability for the target channel
- assets must be versioned; changing the file content without changing the version is a contract violation

## Channel Discipline

- caption safe areas must respect channel-specific layout
- duration must respect channel maximums
- aspect ratio must match the declared target
- file size and bitrate must fit channel constraints

## QC Gate

- the post-render hook must run for every render
- a render that fails QC must not be tagged as "approved"
- failure reports must include scene-level diagnostics and rerun guidance

## Boundary With Other Packages

- this package owns motion, video, animated graphics, and timeline-driven artifacts
- this package does not own static posters, brand KV, design systems, or document-format visuals
- when the request is static, route to `visual-artifact-runner`
- when the request is design judgement, route to `design-director`
- when the request is presentation deck output, route to `morph-ppt`

## Model Selection

- skills must not embed specific model identifiers
- model choice should be expressed through capability tags and resolved by the platform-level visual model router when available
- when a router is unavailable, fall back to a documented default and log the fallback path

## Failure Mode

- never silently produce a degraded artifact when a guardrail is violated
- always emit an explicit failure with the failed guardrail and the suggested remediation
