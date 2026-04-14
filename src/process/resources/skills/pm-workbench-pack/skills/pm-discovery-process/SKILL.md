---
name: pm-discovery-process
description: Run evidence-led product discovery from outcome framing to interviews, synthesis, and experiments before commitment.
compatibility:
  - 'Works best when the user can share metrics, customer notes, support tickets, or stakeholder context.'
  - 'Useful in a linked workspace where discovery notes and experiment plans can be written back into project artifacts.'
---

# PM Discovery Process

Run a full product discovery cycle without slipping into vague research theater or solution-first planning.

## Use when

- A request is still fuzzy and should not become a roadmap commitment yet.
- You need to validate a problem before drafting a serious PRD.
- The team has signals from customers, sales, analytics, or support but no coherent readout.
- A stakeholder is pushing a feature and you need to separate desired outcome from the proposed solution.

## Do not use when

- The problem is already validated and only execution planning remains.
- The work is a small tactical fix or obvious bug.
- Leadership has already hard-committed the scope and you are no longer doing discovery.

## Core principle

Discovery is not "go talk to users and come back later."

It is a disciplined loop:

1. Define the outcome you are trying to move.
2. State the problem hypothesis and the assumptions under it.
3. Gather evidence from qualitative and quantitative sources.
4. Synthesize into patterns, not anecdotes.
5. Choose the smallest next experiment that can change the decision.

## Anti-patterns to block

- Treating a feature request as proof of a customer problem.
- Collecting quotes without mapping them to a real behavioral pattern.
- Running interviews that ask for opinions about your idea instead of past behavior.
- Producing a giant research memo with no decision path.
- Jumping from one interview to a final PRD with no synthesis step.

## Workflow

### Phase 1: Frame the discovery mission

Write down the minimum decision frame:

- Desired outcome
- Candidate customer segment
- Current triggering signal
- Working problem hypothesis
- Decision you expect discovery to inform

Use this sentence when possible:

`We believe [segment] struggles with [problem] because [suspected cause], and resolving it should improve [outcome].`

If you cannot fill this in, discovery is still too vague. Tighten the frame before collecting more input.

### Phase 2: Build the evidence map

Collect evidence across at least three lanes when available:

- Behavioral data: funnel breaks, cohort trends, usage gaps, retention drops
- Customer evidence: interviews, support tickets, churn reasons, sales objections
- Business evidence: revenue pressure, strategic goals, operational pain, market timing

For each signal, label:

- `fact`: observed and sourced
- `interpretation`: your current read of the signal
- `assumption`: still unproven

Do not mix these labels.

### Phase 3: Decide the right discovery move

Choose the lightest method that can reduce uncertainty:

- Interview current users when you need problem depth
- Talk to churned or lost prospects when you need root-cause clarity
- Review support and analytics first when the team already has a lot of raw signal
- Run a concept test or manual prototype when the problem is likely real but the solution is unclear

Default interview guidance:

- Ask about recent behavior, not preferences
- Ask what they tried, what failed, what it cost them
- Ask about the trigger moment, workarounds, and downstream impact
- Avoid pitching your idea during discovery

### Phase 4: Synthesize into opportunities

Turn raw evidence into 2-4 opportunity statements.

An opportunity statement should describe:

- who is affected
- what job or outcome breaks down
- why it matters now
- what evidence supports it

Good example:

`New team admins fail to complete initial setup because policy and invite configuration are split across multiple screens, delaying first value and creating support load.`

Bad example:

`Users need a setup wizard.`

That is already a solution.

### Phase 5: Recommend the next experiment

For each opportunity, define:

- confidence level: low / medium / high
- remaining unknowns
- best next test
- decision threshold

Examples of acceptable next experiments:

- 5 targeted interviews with a specific segment
- concierge workflow or manual service prototype
- clickable concept test
- instrumented funnel check
- pricing or messaging test

## Output format

Return a structured discovery readout:

### 1. Outcome and hypothesis

- Desired outcome
- Working hypothesis
- Decision this discovery should inform

### 2. Evidence table

- Source
- What we observed
- Confidence
- Open interpretation risk

### 3. Opportunity set

- Opportunity statement
- Supporting evidence
- Why it matters

### 4. Recommended next move

- Best next experiment
- Who to involve
- What result would change the decision

## Quality bar

The output is strong only if all of the following are true:

- It distinguishes evidence from assumption.
- It frames problems instead of smuggling in solutions.
- It reduces the next decision, not just "learns more."
- It leaves the team with a concrete next experiment or a justified stop signal.

## Use together with

- `pm-opportunity-solution-tree` when you need to branch from an outcome into multiple opportunities.
- `pm-prd-development` after the problem and direction are strong enough to document a committed solution path.
