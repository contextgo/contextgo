---
name: motion-qc
description: Review motion output against the package review checklist and produce a structured QC report with pass, fail, and rerun decisions.
compatibility:
  - 'Works best after a render is complete and a contact sheet exists.'
  - 'Useful before publishing a motion artifact or signing off on a campaign cut.'
---

# Motion QC

Use this skill to review a motion artifact against the Motion Studio review checklist before it leaves the workspace.

Read `../../references/qc-rubric.md` before reviewing.

## Use when

- A render finished and a contact sheet is available.
- A campaign artifact is about to be published.
- A previous QC pass flagged issues and the rerun must be re-reviewed.

## Do not use when

- The render itself failed. Use `motion-render-ops` to address pipeline failures first.
- The storyboard is still being authored. Use `motion-storyboard`.

## QC failures to avoid

- approving an artifact based on the cover frame alone
- skipping the audio pass because captions look fine
- missing channel-specific safe-area issues
- ignoring caption contrast on channels that allow background bleed
- approving a render that does not match its declared duration or aspect

## Workflow

### 1. Anchor the artifact

Identify the storyboard, target, render manifest, and contact sheet under review.

### 2. First-glance pass

Read the cover frame, the first second after cover, and the captioned text at thumbnail size.

### 3. Composition pass

Verify scene order, intentional transitions, motion-reading-order alignment, and safe areas.

### 4. Audio pass

Verify voiceover intelligibility, caption-voiceover alignment, music continuity, and silent gaps.

### 5. Technical pass

Verify duration, resolution, aspect, file size, bitrate, and cover frame match the declared targets.

### 6. Accessibility pass

Verify caption presence and contrast, and confirm critical information is not audio-only.

### 7. Decision

Mark the artifact as approved, blocked, or minor-edits-needed. For blocked or minor-edits, list the scenes that need rerun and the changed expectation.

### 8. Persist the report

Write the report under `docs/qc/<storyboardId>/<targetId>/report.md` so the decision is discoverable.

## Output format

Return:

### 1. Artifact anchor

- storyboard id, target id, render manifest path

### 2. Pass results

- first-glance, composition, audio, technical, accessibility

### 3. Issues

- per-pass, ranked by severity

### 4. Rerun decisions

- which scenes need rerun and what should change

### 5. Status

- approved, blocked, or minor-edits-needed

### 6. Report path

- the persisted markdown path

## Use together with

- `motion-storyboard`
- `motion-render-ops`
