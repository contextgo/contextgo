# QC

Run QC before calling a render publish-ready.

## Checks

- output file exists and opens
- dimensions, fps, duration, codec, and container match the brief
- representative still frames match storyboard and visible text
- no obvious layout overflow, missing assets, blank frames, or broken alpha
- captions match speech timing and do not block important visuals
- audio levels, silence, voiceover, and music are intentional
- generated asset lineage is complete
- Remotion license status and third-party asset rights are recorded
- rerender command and input props are reproducible

## Verdicts

- `pass`: publish-ready for the declared scope
- `warn`: usable with documented caveats
- `blocked`: rerender or user decision required
