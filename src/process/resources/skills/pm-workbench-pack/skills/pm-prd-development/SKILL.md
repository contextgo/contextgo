---
name: pm-prd-development
description: Turn discovery context into a clear PRD with problem framing, scope boundaries, requirements, and success criteria.
compatibility:
  - 'Works best when there is at least a minimally validated problem and a target user or segment.'
  - 'Useful in a linked workspace where the PRD can be saved and iterated as a living artifact.'
---

# PM PRD Development

Create a product requirements document that earns engineering trust and stakeholder clarity.

## What a good PRD does

A strong PRD explains:

- what problem matters
- for whom it matters
- why now
- what the proposed solution is
- how success will be measured
- what is in scope and out of scope
- what remains uncertain

A PRD is not a giant dump of every idea the team discussed.

## Use when

- Discovery has produced enough confidence to propose committed work.
- Engineering needs a durable decision document instead of scattered chat context.
- A major initiative needs alignment on scope, metrics, and tradeoffs.

## Do not use when

- The team still has not validated the problem.
- The change is tiny and can be captured in a lightweight task or story.
- Stakeholders only want a concept note or option memo, not a committed requirements document.

## Anti-patterns

- Writing the solution section before the problem section is credible
- Hiding uncertainty instead of listing open questions
- Mixing nice-to-have ideas into required scope
- Turning the PRD into a UI spec or implementation spec
- Omitting metrics and then calling the work "strategic"

## PRD structure

### 1. Executive summary

One short paragraph:

- user or segment
- problem
- proposed approach
- expected outcome

### 2. Problem framing

Document:

- target user
- current pain or failure state
- evidence
- business consequence

Use direct evidence where possible:

- analytics signal
- interview quote
- support pattern
- revenue or operational impact

### 3. Why now

Explain urgency without hype:

- strategic timing
- market or customer pressure
- operational cost of waiting
- dependency on upcoming work

### 4. Solution overview

Describe the proposed approach at the right altitude:

- core user flow or job-to-be-done change
- primary surfaces or systems involved
- important non-goals

Do not over-specify UI details unless they affect the decision itself.

### 5. Success metrics

Always include:

- primary metric
- baseline
- target
- leading indicators
- guardrails

Guardrails matter. Avoid "win one metric while breaking another."

### 6. Requirements

Split requirements into clear buckets:

- user needs
- functional requirements
- operational or policy constraints
- edge cases and failure handling

Write requirements in plain language first. Add acceptance criteria when precision matters.

### 7. Scope boundaries

Include:

- in scope
- explicitly out of scope
- assumptions this PRD depends on

This is where you stop scope creep before it starts.

### 8. Dependencies and risks

List:

- upstream teams or systems
- technical enablers
- rollout constraints
- risk and mitigation

### 9. Open questions

A PRD with no open questions is usually dishonest.

List only the unresolved issues that can still change scope, architecture, launch, or measurement.

## PRD writing workflow

### Step 1: inventory the raw inputs

Collect the current source material:

- discovery notes
- stakeholder asks
- analytics snapshots
- design concepts
- engineering constraints

If the input set is thin, say that the PRD is provisional.

### Step 2: write the problem and metric sections first

If these sections stay weak, the solution section will be misleading.

### Step 3: describe the solution and boundaries

Keep the solution tied to the problem. Every major scope item should map back to a user pain, strategic requirement, or measurement need.

### Step 4: pressure-test the document

Ask:

- Could engineering tell what matters most?
- Could a stakeholder tell what is not included?
- Could someone six weeks later understand why this exists?
- Would failure be measurable?

### Step 5: finalize with explicit uncertainty

Tag uncertain areas as:

- discovery follow-up
- design decision
- technical investigation
- policy or go-to-market dependency

## Output format

Return the PRD with these headings:

- Executive Summary
- Problem Statement
- Target Users
- Why Now
- Solution Overview
- Success Metrics
- Requirements
- In Scope / Out of Scope
- Dependencies and Risks
- Open Questions

## Quality bar

The PRD is strong only if:

- the problem statement could survive skeptical review
- the metric section defines success clearly
- out-of-scope items are explicit
- open questions are honest and limited
- the document enables execution without pretending all uncertainty is gone

## Use together with

- `pm-discovery-process` before drafting
- `pm-roadmap-planning` after the initiative is ready to be sequenced with other work
