---
name: pm-roadmap-planning
description: Build an outcome-driven roadmap by defining initiatives, sequencing them, and communicating confidence and tradeoffs.
compatibility:
  - 'Works best when company goals, customer problems, and candidate initiatives are already visible.'
  - 'Useful in a linked workspace where roadmap drafts, sequencing tables, and initiative summaries can be stored.'
---

# PM Roadmap Planning

Turn strategy and demand into a roadmap that explains the logic behind the work instead of dumping a feature list.

## Use when

- You need a quarterly or half-year product roadmap.
- Multiple initiatives compete for the same team capacity.
- Leadership needs sequencing and tradeoffs, not just a backlog export.

## Do not use when

- You are doing sprint planning.
- The strategy and target outcomes are still unclear.
- The organization expects a fixed delivery contract rather than a roadmap conversation.

## A roadmap is not

- a promise that every listed item will ship exactly as written
- a raw list of feature requests
- a substitute for prioritization
- a delivery plan with implementation tasks

## Core ingredients

A strong roadmap has four things:

1. clear outcomes
2. coherent initiative definitions
3. sequencing logic
4. confidence labels

If any of these are missing, the roadmap becomes political theater.

## Anti-patterns

- Building the roadmap from stakeholder requests instead of outcomes
- Mixing committed work and speculative exploration without labels
- Sequencing by who shouted loudest
- Listing features without naming the customer or business problem
- Ignoring enabling work, platform investments, or dependencies

## Workflow

### Phase 1: Gather the inputs

Collect four lanes of input:

- business goals and leadership commitments
- validated customer problems
- candidate initiatives or epics
- technical constraints and platform work

For each candidate initiative, capture:

- problem it addresses
- expected outcome
- rough effort
- major dependency
- confidence level

### Phase 2: Normalize initiatives

Rewrite candidate work into initiative statements that are outcome-linked.

Bad:

`Advanced reporting`

Better:

`Improve retention for finance admins by reducing manual monthly reporting work.`

Each initiative should have:

- target segment
- value hypothesis
- primary metric
- rough size

### Phase 3: Prioritize before sequencing

Do not sequence unranked work.

Use a simple prioritization summary:

- expected outcome leverage
- evidence quality
- strategic fit
- effort and dependency load

If formal framework selection is unclear, use `pm-prioritization-advisor`.

### Phase 4: Sequence the work

Use one of these structures:

- Now / Next / Later
- quarterly timeline
- strategic themes with time windows

Choose based on audience:

- executives: themes plus confidence
- delivery teams: quarter plus dependency notes
- wider org: now/next/later with plain-language rationale

When sequencing, make these explicit:

- what unlocks later work
- what is only exploratory
- what is committed
- what moved out and why

### Phase 5: Write the roadmap narrative

A good roadmap needs a short story:

- what outcomes matter this period
- why these initiatives made the cut
- how the work is staged
- what remains intentionally uncommitted

Without this narrative, the roadmap will be read as a random stack rank.

## Output format

Return:

### 1. Planning frame

- period covered
- audience
- planning assumptions

### 2. Outcome priorities

- top business or customer outcomes

### 3. Initiative table

- initiative
- target problem
- expected metric impact
- size or effort band
- confidence

### 4. Sequenced roadmap

- now
- next
- later

### 5. Tradeoffs and risks

- what did not make the cut
- dependency risk
- evidence gaps

### 6. Recommended communication notes

- how to explain this roadmap to stakeholders

## Quality bar

The roadmap is strong only if:

- every initiative maps to an outcome
- sequencing logic is visible
- confidence is explicit
- tradeoffs are named
- the document avoids feature-factory language

## Use together with

- `pm-prioritization-advisor` before ranking
- `pm-feature-investment-advisor` when a large initiative needs a stronger financial lens
