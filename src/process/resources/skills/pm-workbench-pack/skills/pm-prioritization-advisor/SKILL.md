---
name: pm-prioritization-advisor
description: Choose and apply the right prioritization lens for the current product stage, evidence quality, and stakeholder environment.
compatibility:
  - 'Works best when the user can describe product stage, available data, and the kind of tradeoff being made.'
  - 'Useful before roadmap planning or whenever teams are stuck arguing about how to rank work.'
---

# PM Prioritization Advisor

Use this skill to decide how work should be prioritized before anyone starts pretending a spreadsheet score is objective truth.

## What this skill solves

Different contexts need different prioritization lenses.

- Early-stage products often need speed and judgment.
- Growth-stage teams often need lightweight scoring and clearer tradeoffs.
- Mature products often need more data discipline and portfolio thinking.

The point is not to worship a framework. The point is to use one that fits the situation.

## Common frameworks and when they fit

### RICE

Use when:

- you have enough usage or customer volume data
- work items are comparable
- reach and effort can be estimated with some discipline

Avoid when:

- impact is mostly strategic or qualitative
- estimates are mostly fiction

### ICE

Use when:

- speed matters more than precision
- the team needs a lightweight first pass
- data exists but is incomplete

Avoid when:

- leadership expects rigorous financial or portfolio logic

### Value vs Effort

Use when:

- you need to compare quick wins, strategic bets, and expensive investments
- the team needs a fast workshop-friendly view

Avoid when:

- you need a repeatable scoring mechanism across many teams

### Weighted scoring

Use when:

- you need transparency across multiple stakeholder dimensions
- the org wants criteria such as strategic fit, retention effect, revenue, compliance, and effort

Avoid when:

- the team will game the weights without agreeing on the criteria definitions

### Cost of delay or urgency-based lenses

Use when:

- timing changes the value dramatically
- compliance, contract deadlines, or market windows matter

Avoid when:

- everything gets labeled "urgent"

## Decision questions

Assess the situation on four axes:

1. Product stage
2. Data quality
3. Stakeholder complexity
4. Nature of the tradeoff

### Product stage

- pre-PMF
- scaling
- mature optimization
- multi-product portfolio

### Data quality

- weak
- partial
- strong

### Stakeholder complexity

- small aligned team
- several functions but aligned
- misaligned or political environment
- portfolio coordination across teams

### Nature of the tradeoff

- filter a large backlog
- compare strategic bets vs quick wins
- defend a decision to leadership
- sequence work under dependency constraints

## Recommendation logic

Use these defaults:

- weak data + early stage -> ICE or value/effort
- moderate data + single-team roadmap -> RICE or weighted scoring
- strategic / cross-functional dispute -> weighted scoring plus narrative rationale
- high urgency or contractual timing -> add cost-of-delay view

If the request mixes several contexts, recommend a primary framework and a secondary check rather than inventing one giant hybrid.

## Scoring hygiene

Regardless of framework:

- define each criterion clearly
- score all items on the same horizon
- show assumptions next to scores
- do not claim precision beyond the evidence
- rerun the framework when stage or evidence materially changes

## Output format

Return:

### 1. Context read

- stage
- data quality
- stakeholder environment
- decision type

### 2. Recommended framework

- framework name
- why it fits
- when it will fail

### 3. How to apply it

- scoring dimensions
- rating guidance
- needed inputs

### 4. Ranked view or scoring template

- score table or comparison table

### 5. Final recommendation

- top options
- what drove the ranking
- biggest assumption still affecting the decision

## Quality bar

This skill is successful only if:

- the framework recommendation matches the situation
- assumptions are visible
- the output helps the user make a decision now
- it does not hide weak evidence behind fake math

## Use together with

- `pm-feature-investment-advisor` when cost, margin, or payback matter
- `pm-roadmap-planning` when prioritization must feed directly into sequencing
