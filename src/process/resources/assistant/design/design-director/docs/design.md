# Design Director Preset Design

This document records the first absorption design for the built-in `Design Director` assistant preset.

The goal is not to build a shallow agent that says "make it cleaner" or "make it look like brand X." The goal is to absorb the strongest parts of `awesome-design-md` / `getdesign` into ContextGo's own first-party design-direction workflow.

## References actually downloaded and reviewed

### 1. `VoltAgent/awesome-design-md`

- Local repository: `/Users/bytedance/contextgo/awesome-design-md`
- Commit: `62437487397768c31f665de7e3a108956a25f381`
- License: MIT

Files actually reviewed in this round:

- `README.md`

### 2. DESIGN.md samples fetched through the `getdesign` CLI

Files actually fetched and reviewed:

- `/Users/bytedance/contextgo/agent-repo/design-md-samples/figma/DESIGN.md`
- `/Users/bytedance/contextgo/agent-repo/design-md-samples/vercel/DESIGN.md`
- `/Users/bytedance/contextgo/agent-repo/design-md-samples/notion/DESIGN.md`

These are not placeholder READMEs. They are real design-system documents fetched through `npx getdesign@latest add <brand>`.

## Why this should become an independent built-in preset

`PM Workbench` covers product discovery, strategy, PRDs, and roadmap logic.

`Morph PPT` covers presentations and animated narrative output.

But there is still no built-in assistant that specializes in:

- choosing the right visual archetype for a product
- extracting the real design logic from external references
- turning that logic into a project-level `DESIGN.md`
- art-directing landing pages versus product surfaces differently
- critiquing an existing UI at the system level instead of giving taste-only feedback
- handing design intent to frontend implementation in a way that is actually usable

Without that layer, design tasks get fragmented across:

- ad-hoc frontend prompts
- vague aesthetic feedback
- one-off page edits

They lack a unified design-judgment layer.

In one sentence:

- `Design Director` owns visual direction, design-system distillation, page art direction, and UI critique
- frontend agents own implementation

## Distillation boundary

This preset should absorb **design-system method**, not a third-party brand shell.

### Keep

- the `DESIGN.md` way of expressing design systems for agents
- the structure of atmosphere, palette, type, components, layout, motion, and do/don'ts
- the idea that different surfaces need different page lenses
- turning reference aesthetics into reusable visual archetypes
- producing design output that is implementation-aware

### Do not import directly

- third-party brand names as the identity of a built-in ContextGo assistant
- full upstream brand documents verbatim
- workflows that depend on live online access to complete the core job
- reducing design work to image prompts

### ContextGo-native mapping

This preset should be absorbed into ContextGo-native constructs:

- assistant rules that teach design judgment
- a first-party distilled design skill pack
- workspace commands for recurring design workflows
- a linked workspace as the default home for `DESIGN.md`, art-direction briefs, critique notes, and handoff docs

## Proposed preset identity

### Assistant id

- `builtin-design-director`

### Display name

- `Design Director`

### Recommended domain

- `Design Direction`

### Positioning

A built-in design-direction assistant centered on a linked workspace, focused on visual-archetype selection, project-level DESIGN.md distillation, page art direction, UI critique, and implementation-ready handoff.

## Why the current references are already strong enough

The three fetched samples already show clear visual-archetype separation:

### `figma`

- colorful creative content sitting on a black-and-white structural interface
- distinctive typography, pill geometry, and focus treatment
- suitable to abstract into a `vibrant-tooling` archetype

### `vercel`

- compressed monochrome precision, developer-infrastructure tone, shadow-as-border treatment
- suitable to abstract into a `precision-mono` archetype

### `notion`

- warm minimalism, content-first calm, soft surfaces, editorial workspace tone
- suitable to abstract into a `warm-editorial` archetype

Together they show that this source is best used for:

- visual-archetype selection
- design-system distillation
- page art direction

It is not best used as a brand-copy engine.

## Proposed first-party distilled skill pack

Suggested package name:

- `design-director-pack`

### Core skills

1. `design-style-archetype-selection`

- Choose the right visual archetype based on product type, user mindset, trust requirements, and brand tone.
- Start with three primary archetypes:
  - `precision-mono`
  - `warm-editorial`
  - `vibrant-tooling`

2. `design-system-distillation`

- Turn product goals, brand voice, and reference inputs into a project-level `DESIGN.md` or design brief.
- The output must cover atmosphere, palette, type, components, layout, motion, and do-not-do rules.

3. `design-landing-page-art-direction`

- For marketing pages, launch pages, homepages, and campaign pages.
- Focus on hero strategy, narrative rhythm, CTA hierarchy, module pacing, visual breathing room, and motion direction.

4. `design-product-surface-art-direction`

- For dashboards, workspaces, settings, tables, forms, and operator surfaces.
- Focus on information density, navigation hierarchy, component ranking, empty states, feedback states, and high-frequency task flow.

5. `design-ui-critique-and-polish`

- Critique an existing UI sharply.
- The goal is not "does it look like the reference?" but whether hierarchy, pacing, color logic, component consistency, interaction, and implementation discipline hold together.

6. `design-screenshot-critique`

- Critique screenshots, stills, and mockups through a first-scan read before diving into polish details.
- Focus on hierarchy, density, action ranking, scan path, and the smallest redesign moves with the highest value.

7. `design-figma-reference-absorption`

- When the user references Figma, extract the structural signals that matter instead of copying a brand shell.
- Translate monochrome chrome, expressive content zones, micro-typography, geometry, and focus language into product-native rules.

8. `design-system-adaptation`

- When a project already has a design system, translate the desired reference style into a compatible token/component language.
- Make explicit what must remain stable and what is allowed to change.

9. `design-component-visual-spec`

- Push design direction down to buttons, tabs, cards, tables, inputs, dialogs, and panels.
- Write component anatomy, variants, state rules, composition rules, and acceptance checks instead of vague styling notes.

10. `design-handoff-brief`

- Convert design conclusions into a frontend-ready handoff.
- Include structure, tokens, components, states, responsive behavior, motion, and acceptance checks.

## Suggested default enabled skills

- `design-style-archetype-selection`
- `design-system-distillation`
- `design-landing-page-art-direction`
- `design-product-surface-art-direction`
- `design-ui-critique-and-polish`
- `design-screenshot-critique`
- `design-figma-reference-absorption`
- `design-system-adaptation`
- `design-component-visual-spec`
- `design-handoff-brief`

## Proposed workspace commands

### 1. `pick-style`

Uses:

- `design-style-archetype-selection`

Role:

- Choose the right visual archetype before UI work drifts into generic output

### 2. `draft-design-system`

Uses:

- `design-style-archetype-selection`
- `design-system-distillation`

Role:

- Draft a project-level `DESIGN.md` or design brief

### 3. `art-direct-page`

Uses:

- `design-system-distillation`
- `design-landing-page-art-direction` or `design-product-surface-art-direction`

Role:

- Produce page-level art direction instead of vague aesthetic advice

### 4. `critique-ui`

Uses:

- `design-ui-critique-and-polish`
- `design-system-adaptation`

Role:

- Surface the most important system-level UI problems and define the highest-value polish moves

### 5. `review-screenshot`

Uses:

- `design-screenshot-critique`
- `design-ui-critique-and-polish`

Role:

- Critique screenshots through the first scan, highlight the highest-severity issues, and recommend the smallest high-value redesign moves

### 6. `absorb-figma-reference`

Uses:

- `design-figma-reference-absorption`
- `design-system-adaptation`
- `design-system-distillation`

Role:

- Translate the right Figma signals into first-party design rules without turning the result into a clone

### 7. `adapt-system`

Uses:

- `design-system-adaptation`
- `design-system-distillation`

Role:

- Translate an outside visual reference into an existing design system without breaking product consistency

### 8. `spec-component`

Uses:

- `design-component-visual-spec`
- `design-handoff-brief`

Role:

- Push page-level direction into component-level implementation rules with anatomy, states, and acceptance checks

### 9. `write-handoff`

Uses:

- `design-handoff-brief`

Role:

- Produce a design handoff that frontend implementation can follow directly

## Relationship to existing product surfaces

This preset does not replace frontend implementation, and it does not replace image-generation skills.

### Relationship to frontend implementation

- `Design Director` decides what the design should be
- frontend agents decide how to implement it

### Relationship to `infographic-image`

- `infographic-image` is for turning content into visual images
- `Design Director` is for product UI and page system direction

### Relationship to `Morph PPT`

- `Morph PPT` is for presentations
- `Design Director` is for product UI and page aesthetics

## Recommended first release scope

Do not introduce in v1:

- Figma connectors
- screenshot annotation loops
- extra hooks, timers, or connectors

Do complete in v1:

1. the built-in preset shell
2. the first-party distilled skill pack
3. the workspace commands
4. the assistant rules
5. the third-party notices

At that point, `Design Director` is already a real design-direction assistant rather than a shell built from brand names and adjectives.
