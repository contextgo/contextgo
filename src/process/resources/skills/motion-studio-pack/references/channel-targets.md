# Channel Targets Reference

Each channel imposes its own framing, duration, and caption rules. Storyboards should match these unless the user explicitly opts out.

## Vertical Social

- aspect: `9:16`
- duration: 5 to 60 seconds
- caption: required
- safe area: account for top UI overlay and bottom action bar
- cover frame: optimized for portrait thumbnail

## Square Social

- aspect: `1:1`
- duration: 5 to 60 seconds
- caption: required
- safe area: balanced central area
- cover frame: legible at small thumbnail

## Horizontal Web

- aspect: `16:9`
- duration: 10 seconds to several minutes
- caption: optional but recommended
- safe area: avoid extreme corners for cropped embeds

## Event Display

- aspect: `16:9` or `21:9`
- duration: 5 to 30 seconds, often loopable
- caption: typically not required
- safe area: account for stage masking

## Internal Review

- aspect: matches the source storyboard
- duration: full length
- caption: optional
- intended for QC and approval, not publication
