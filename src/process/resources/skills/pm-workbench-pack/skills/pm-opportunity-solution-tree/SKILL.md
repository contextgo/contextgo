---
name: pm-opportunity-solution-tree
description: Build an outcome-to-opportunity map before converging on solutions or roadmap commitments.
compatibility:
  - 'Works best when the user can state a target metric, strategic outcome, or stakeholder ask.'
  - 'Useful before PRD writing when multiple possible problem spaces are still in play.'
---

# PM Opportunity Solution Tree

Use this skill to stop a request from collapsing straight into "build feature X."

## What this skill does

It builds a structured tree:

- outcome
- opportunities
- solution options
- validation tests

The goal is not to draw a pretty tree. The goal is to force divergence before commitment.

## Use when

- A stakeholder has jumped to a proposed feature.
- You have a goal but several possible customer problems could explain it.
- The team needs a lightweight discovery artifact before PRD or roadmap work.

## Avoid these failures

- Writing opportunities that are secretly features
- Starting from the loudest stakeholder instead of the desired outcome
- Listing one opportunity and one solution, then pretending alternatives were considered
- Treating the tree as a roadmap rather than a discovery lens

## Building the tree

### Step 1: Lock the outcome

State one measurable outcome.

Examples:

- Increase activation from 42% to 55%
- Reduce admin setup time from 3 days to 1 day
- Improve enterprise expansion conversion by 20%

If the outcome is not measurable, it is too weak for the top of the tree.

### Step 2: Generate 3 opportunities

Write 3 distinct customer opportunities that could move the outcome.

Each opportunity should be phrased as a customer struggle, unmet need, or blocked job.

Checklist:

- grounded in behavior or evidence
- not a feature in disguise
- distinct from the other branches
- plausible path to the outcome

### Step 3: Expand solution options under each opportunity

Generate multiple solution ideas under each opportunity.

Good branching looks like:

- workflow change
- product feature
- messaging or onboarding change
- service or human assist
- instrumentation or internal tooling

Do not assume the right answer is always a shipped product feature.

### Step 4: Add a validation move

Every solution branch needs a test before commitment.

Examples:

- interview script
- concierge trial
- prototype review
- messaging test
- analytics instrumentation
- lightweight A/B test

The test should answer the biggest unknown on that branch.

### Step 5: Pick the best branch to pursue

Select the next branch using four filters:

- customer pain intensity
- evidence quality
- expected outcome leverage
- implementation feasibility

If two branches are close, prefer the one with the cheapest decisive test.

## Output template

Use this structure:

### Desired outcome

- metric
- baseline
- target
- time horizon

### Opportunities

1. Opportunity
   - evidence
   - why it matters
   - confidence
2. Opportunity
   - evidence
   - why it matters
   - confidence
3. Opportunity
   - evidence
   - why it matters
   - confidence

### Candidate solutions by opportunity

- Opportunity 1
  - Solution A
  - Solution B
  - Solution C
- Opportunity 2
  - Solution A
  - Solution B
  - Solution C
- Opportunity 3
  - Solution A
  - Solution B
  - Solution C

### Best next branch

- selected opportunity
- selected solution hypothesis
- validation test
- success signal
- kill signal

## Quality bar

The tree is useful only if:

- the top outcome is specific
- the opportunity layer is written in problem language
- multiple branches were truly considered
- the output ends in a testable next move, not just a brainstorm list

## Use together with

- `pm-discovery-process` when the evidence base is still weak
- `pm-prd-development` once one branch has earned commitment
