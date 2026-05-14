---
name: pm-feature-investment-advisor
description: Evaluate whether a feature deserves investment using revenue linkage, cost structure, strategic value, and risk.
compatibility:
  - 'Works best when the user can provide rough business metrics, team cost, or operating assumptions.'
  - 'Useful for large initiatives, enterprise asks, monetization work, and expensive infrastructure-backed features.'
---

# PM Feature Investment Advisor

Use this skill when prioritization needs a financial and strategic investment lens, not just a feature ranking score.

## What this skill asks

`Should we invest in this feature now, later, or not at all?`

That means looking at:

- revenue connection
- retention or expansion effect
- one-time build cost
- ongoing operating cost
- strategic value
- downside risk

## Use when

- the initiative is expensive enough to deserve financial scrutiny
- leadership wants an investment case, not just a score
- there is a monetization, retention, or enterprise revenue angle
- a platform or AI feature has meaningful ongoing cost

## Do not use when

- the item is tiny and cheap
- the work is clear table stakes and must exist regardless of ROI
- discovery is still too weak to estimate value credibly

## Anti-patterns

- treating top-line revenue as the only value signal
- ignoring COGS and support overhead
- confusing strategic necessity with proven ROI
- building an ROI model from invented adoption numbers and then treating it as fact

## Evaluation model

### 1. Identify the value path

Classify the feature's main value mechanism:

- direct monetization
- better conversion
- retention improvement
- expansion enablement
- strategic / enabling investment

The user may mention several. Choose the primary one and note the rest as secondary effects.

### 2. Estimate the cost structure

Capture:

- one-time build effort
- rollout and enablement effort
- ongoing infra or vendor cost
- support or operational overhead

If cost is uncertain, present ranges rather than a fake point estimate.

### 3. Estimate the impact range

Use conservative, base, and upside scenarios when possible.

Examples:

- adoption rate for a paid add-on
- churn reduction range for a retention feature
- pipeline or deal unlock rate for enterprise asks
- activation lift for onboarding work

### 4. Add the strategic overlay

A financially weak feature may still make sense if it:

- unlocks future platform capability
- protects a critical segment
- closes a severe compliance or security gap
- removes a blocker for a larger roadmap move

Make this explicit. Do not smuggle it into the math.

### 5. Make the decision recommendation

Choose one:

- invest now
- validate first, then invest
- defer
- reject

The recommendation must name what would change the call.

## Output format

Return:

### 1. Feature summary

- feature
- target segment
- decision to make

### 2. Value path

- primary value mechanism
- secondary effects

### 3. Cost profile

- build cost
- ongoing cost
- operational implications

### 4. Impact scenarios

- conservative
- base
- upside

### 5. Strategic modifiers

- moat, compliance, platform leverage, or timing factors

### 6. Recommendation

- invest now / validate first / defer / reject
- rationale
- biggest assumption to test next

## Quick heuristics

- If upside is modest and costs are high, default to defer unless the feature is strategically mandatory.
- If the feature can unlock significant revenue but the adoption assumption is weak, recommend validate-first instead of immediate commitment.
- If the feature is table stakes for a target segment, treat it as a market-access investment rather than a pure ROI play.

## Quality bar

This skill is successful only if:

- the value path is clear
- cost includes ongoing burden, not just build effort
- strategic arguments are separated from the financial model
- the final recommendation is tied to specific assumptions and next evidence
