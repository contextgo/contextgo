---
name: office-briefing
description: Turn messy office inputs into a decision-friendly brief with evidence, risks, and clear takeaways.
compatibility:
  - 'Works best when several office files or notes must be collapsed into a concise readout.'
  - 'Useful for management updates, handoff briefs, and meeting prep.'
---

# Office Briefing

Use this skill to convert office noise into a brief someone can read quickly and act on.

## Use when

- The user has multiple office files and wants a clean summary.
- A manager or stakeholder needs a short readout before a meeting.
- The analysis is done, but the message still needs shaping.

## Do not use when

- The task still needs heavy extraction or reconciliation first.
- The user needs a full formal report rather than a short brief.

## Briefing rules

- Lead with the decision or most important takeaway.
- Keep evidence tied to source files or source types.
- Separate confirmed findings from plausible interpretation.
- End with what needs action, approval, or follow-up.

## Workflow

### Step 1: Identify the audience

Examples:

- manager
- cross-functional project lead
- finance reviewer
- customer-facing owner

The audience changes the amount of detail.

### Step 2: Collapse the input set

Group inputs into:

- facts
- conclusions
- unresolved questions

### Step 3: Write the brief

A solid office brief usually has:

- executive summary
- key facts
- issues or risks
- recommended next actions

## Output format

Return:

### Executive Summary

2-5 bullets max.

### Key Facts

Only the facts needed to support the brief.

### Risks or Open Questions

What is still uncertain or blocked.

### Recommended Next Actions

What should happen next and by whom if known.

## Use together with

- `office-document-operations`
- `office-source-reconciliation`
- `office-report-drafting`
