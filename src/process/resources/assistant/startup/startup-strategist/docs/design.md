# Startup Strategist Preset Design

This document records the first-pass absorption plan for a built-in `Startup Strategist` assistant preset.

The goal is not to import upstream startup bundles verbatim. The goal is to absorb the strongest strategic workflows into a ContextGo-native preset that helps founders and zero-to-one teams move from startup idea to segment choice, value proposition, GTM, and metrics with disciplined reasoning.

## Upstream references that were actually downloaded

### 1. `rameerez/claude-code-startup-skills`

- Local clone: `/Users/bytedance/contextgo/agent-repo/claude-code-startup-skills`
- Commit: `410f81f83e4ac309032eab3d3265353f97ea665f`
- License: MIT

Primary source reviewed:

- `README.md`
- `skills/customer-empathy/SKILL.md`

### 2. `phuryn/pm-skills`

- Local clone: `/Users/bytedance/contextgo/agent-repo/phuryn-pm-skills`
- Commit: `36ccefdc6c2e00d7c0c12cb0a52bf93e8ec50da4`
- License: MIT

Primary startup sources reviewed:

- `pm-product-strategy/skills/startup-canvas/SKILL.md`
- `pm-product-strategy/skills/value-proposition/SKILL.md`
- `pm-product-strategy/skills/swot-analysis/SKILL.md`
- `pm-go-to-market/skills/ideal-customer-profile/SKILL.md`
- `pm-go-to-market/skills/gtm-strategy/SKILL.md`
- `pm-marketing-growth/skills/north-star-metric/SKILL.md`

## Why this should become a separate built-in preset

`PM Workbench` already covers:

- evidence-led product discovery
- strategy framing for product teams
- PRDs, prioritization, and roadmap planning

That is valuable, but it starts after a team already has some product footing.

`Startup Strategist` should sit one level earlier and focus on founder-stage questions:

- is the problem sharp enough to build around
- who is the beachhead segment
- what value proposition is strong enough to win attention
- what tradeoffs define the business
- what initial GTM motion is credible
- what metric system reflects actual customer value

In short:

- `Startup Strategist` is for zero-to-one strategic choices
- `PM Workbench` is for turning those choices into product operating decisions

## Distillation boundary

The preset should absorb the methodology, not the upstream package shape.

### Keep

- customer empathy and JTBD-first founder framing
- startup canvas separation between strategy and business model
- value proposition structure with explicit alternatives
- ICP definition for the beachhead segment
- SWOT-style strategic diagnosis
- GTM planning with channel and messaging discipline
- North Star metric selection and input-metric constellation

### Do not import directly

- upstream plugin metadata and command packaging
- Google Doc or template links as product dependencies
- upstream marketplace distribution mechanics
- overly generic PM outputs that ignore startup-stage uncertainty

### ContextGo-native adaptation

The preset should map startup work into ContextGo-native constructs:

- assistant rules that teach startup decision behavior
- a first-party distilled skill pack
- workspace commands for recurring founder workflows
- linked workspaces as the default place for canvases, briefs, and validation plans

## Proposed preset identity

### Assistant id

- `builtin-startup-strategist`

### Display name

- `Startup Strategist`

### Recommended domain

- `Startup Strategy`

### Positioning

A built-in founder strategy assistant for startup idea pressure-testing, segment choice, value proposition shaping, GTM design, North Star metrics, and founder-ready strategic briefs around a linked workspace.

## Proposed first-party distilled skill pack

Suggested package name:

- `startup-strategist-pack`

### Core skills

1. `startup-founder-problem-framing`

- Start from the founder's belief, but force customer empathy, JTBD, urgency, and the shortest path to user value.
- Explicitly separate evidence, observed pain, and founder intuition.

2. `startup-startup-canvas`

- Build a startup canvas that keeps strategy distinct from the business model.
- Make vision, segment choice, value proposition, tradeoffs, growth motion, capabilities, defensibility, cost structure, and revenue streams explicit.

3. `startup-value-proposition`

- Structure the value proposition through who, why, what before, how, what after, and alternatives.
- Force a usable positioning statement at the end.

4. `startup-ideal-customer-profile`

- Define the beachhead segment with firmographic or role signals, behaviors, JTBD, pain points, buying context, and disqualification rules.

5. `startup-strategic-diagnosis`

- Combine market timing, alternatives, SWOT, strategic pressure points, and what must be true.
- Use this for market scans and pressure-testing, not just descriptive market summaries.

6. `startup-go-to-market-strategy`

- Turn the beachhead segment and value proposition into a focused GTM motion with channels, messaging, proof assets, and a 90-day plan.

7. `startup-north-star-metric`

- Select the North Star metric and 3-5 input metrics.
- Keep the metric system customer-value-first rather than vanity-led.

8. `startup-founder-brief`

- Synthesize the current startup position into a founder-grade strategic brief with thesis, choices, risks, tests, and next moves.

## Proposed default enabled skills

The preset should default to the startup pack itself:

- `startup-founder-problem-framing`
- `startup-startup-canvas`
- `startup-value-proposition`
- `startup-ideal-customer-profile`
- `startup-strategic-diagnosis`
- `startup-go-to-market-strategy`
- `startup-north-star-metric`
- `startup-founder-brief`

## Proposed workspace commands

### 1. `stress-idea`

Use:

- `startup-founder-problem-framing`
- `startup-strategic-diagnosis`
- `startup-startup-canvas`

Intent:

- pressure-test whether the startup idea is solving a real enough problem for a real enough segment under credible market conditions

### 2. `design-canvas`

Use:

- `startup-startup-canvas`

Intent:

- generate a full startup canvas that separates strategy from business model

### 3. `scan-market`

Use:

- `startup-strategic-diagnosis`
- `startup-founder-problem-framing`

Intent:

- inspect market timing, alternatives, SWOT, and pressure points before committing

### 4. `define-icp`

Use:

- `startup-ideal-customer-profile`
- `startup-founder-problem-framing`

Intent:

- identify the beachhead customer and make fit and non-fit explicit

### 5. `shape-value-prop`

Use:

- `startup-value-proposition`
- `startup-founder-problem-framing`
- `startup-ideal-customer-profile`

Intent:

- turn a vague promise into a segment-specific value proposition and positioning statement

### 6. `plan-gtm`

Use:

- `startup-go-to-market-strategy`
- `startup-ideal-customer-profile`
- `startup-value-proposition`

Intent:

- build the smallest credible GTM motion for the beachhead segment

### 7. `set-north-star`

Use:

- `startup-north-star-metric`
- `startup-go-to-market-strategy`

Intent:

- choose the startup's primary metric and the few leading indicators that matter

### 8. `write-founder-brief`

Use:

- `startup-founder-brief`
- `startup-startup-canvas`
- `startup-strategic-diagnosis`
- `startup-go-to-market-strategy`

Intent:

- synthesize the current startup direction into a founder-ready strategy brief
