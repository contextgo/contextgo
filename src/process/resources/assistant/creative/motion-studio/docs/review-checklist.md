# Review Checklist

Motion output must pass review before it leaves the workspace. The post-render hook should attach this checklist to every render.

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

## Reviewer Output

Reviewers should produce a short report under `docs/qc/<storyboardId>/<targetId>/report.md` that lists:

- which passes were satisfied
- which passes flagged issues
- which scenes need a rerun and what changed expectation should be
- whether the artifact is approved, blocked, or needs minor edits
