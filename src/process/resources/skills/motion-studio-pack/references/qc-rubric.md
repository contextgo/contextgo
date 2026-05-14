# QC Rubric

Use this rubric when reviewing a motion artifact.

## First-Glance Pass

- the cover frame reads in under one second
- the first frame after the cover communicates intent
- the opening hook does not waste the first second on logos or filler
- the captioned text in the first scene is legible at thumbnail size

## Composition Pass

- scene order matches the storyboard
- transitions feel intentional, not stitched
- motion does not fight the viewer's reading order
- text and key visuals stay inside channel safe areas

## Audio Pass

- voiceover is intelligible against music and ambient
- music does not abruptly drop or peak between scenes
- caption timing matches voiceover within reasonable tolerance
- there is no silent gap longer than the storyboard intends

## Technical Pass

- declared duration matches actual duration
- resolution matches the channel target
- aspect ratio matches the channel target
- file size and bitrate fit channel constraints
- cover frame matches the storyboard `coverFrame` choice

## Accessibility Pass

- captions are present where required
- caption contrast meets the workspace contrast token
- no critical information is communicated through audio alone

## Severity

- `blocker`: prevents publication; rerun required
- `major`: significant quality drop; minor edit usually required
- `minor`: small polish item; can ship if scoped

## Status Decisions

- `approved`: every pass succeeded or only minor items remain inside the polish budget
- `minor-edits-needed`: ships after a small follow-up
- `blocked`: must rerun before publication
