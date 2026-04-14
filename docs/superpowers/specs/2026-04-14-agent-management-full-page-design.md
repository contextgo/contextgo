# Agent Management Full-Page Workspace Design

**Date:** 2026-04-14
**Status:** Approved for implementation

## Overview

Redesign the Settings `AI Agent` area from a list-plus-drawer flow into a route-based full-page workspace rendered inside the existing desktop settings shell:

- keep the left settings navigation unchanged
- render Agent list, create flow, and detail pages in the full right content pane
- remove Agent detail editing as the primary modal/drawer interaction
- align Agent detail IA with the `Agent Package` model instead of a single long waterfall form

This design covers the user-facing assistant management surface under `/settings/agent`. It does not redesign the runtime manager, channel publication page, or Context Engine system-runs page.

## Goals

- Make every Agent detail entry open as a full right-pane page instead of a drawer.
- Make the `Create AI Agent` flow a full page instead of a drawer.
- Give Agent details a stable route, browser-back behavior, and deep-link semantics.
- Reframe Agent details around package capabilities and package documentation.
- Replace waterfall presentation with a structured workbench layout and tab-based navigation.
- Preserve current editability rules for builtin, extension, and custom assistants.

## Non-Goals

- Redesign `/settings/runtime`, `/settings/channels`, `/settings/agent-publish`, or `/settings/system-runs`.
- Change the underlying `Agent Package` filesystem contract or install model.
- Introduce package import, remote package browsing, or cloud sync in this slice.
- Rework Context Engine system-agent management beyond keeping existing links intact.

## Current Problems

### Drawer-first interaction is too small for Agent Package content

The current `AssistantEditDrawer` mixes identity, runtime choice, prompt/rules, skills, hooks, and package-derived content into one constrained surface. This is workable for short forms, but it breaks down once the product treats assistants as full `Agent Packages` with:

- `skills`
- `hooks`
- `schedules`
- `commands`
- `AGENTS.md`
- `docs/`

### Detail information has no page-level hierarchy

The current model is still close to `click card -> open editor drawer -> scroll down`. That makes package capabilities feel like appended form blocks instead of first-class surfaces with their own structure and navigation.

### There is no durable route model for details

The current detail interaction is local state, not route state. That prevents:

- opening the same assistant detail from multiple entry points with consistent behavior
- deep-linking to a specific assistant or tab
- using browser back as the primary return mechanism
- remembering the current detail sub-surface

### Docs and `AGENTS.md` are not first-class browsing surfaces

The product already treats `AGENTS.md` and `docs/` as first-class package surfaces, but the current assistant UI does not expose them as a clear document-reading experience.

## Product Principles

### 1. Agent management is a page workspace, not a dialog workflow

The desktop product model is already `left settings nav + right content area`. Agent management should follow that model. Detail pages should render as normal pages inside the settings content pane.

### 2. Agent Package surfaces define the detail IA

The detail page should reflect the package model directly. The main tabs come from the package capability and package-doc surfaces, not from arbitrary form grouping.

Canonical detail tabs come from this set:

- `Skills`
- `Hooks`
- `Schedules`
- `Commands`
- `AGENTS.md`
- `Docs`

### 3. Agent basics stay available, but they are not the primary tab taxonomy

Assistant identity and runtime configuration are still needed, especially for custom assistants. They should live in the page header and an inline `Basics` inspector panel, not as another top-level waterfall page.

This keeps the tab model aligned with the package manifest and surfaced content while preserving editable assistant metadata.

### 4. Docs should be browsed like docs, not shown as cards

`Docs` must become a document browser with a real tree and reader. `AGENTS.md` must become a contract page with structure and document affordances, not just a long raw markdown block inserted into a form.

## Route Model

The Agent area becomes a route-based workspace under `/settings/agent`.

### Primary routes

- `/settings/agent`
  - Agent list page
- `/settings/agent/new`
  - full-page create flow
- `/settings/agent/new?duplicate=<assistantId>`
  - create page seeded from an existing assistant
- `/settings/agent/:assistantId`
  - detail route that resolves and redirects to the default tab
- `/settings/agent/:assistantId/:tabId`
  - concrete detail tab route

### Supported detail tabs

`tabId` is one of:

- `skills`
- `hooks`
- `schedules`
- `commands`
- `agents`
- `docs`

`agents` is the route segment for the `AGENTS.md` contract page. The visible tab label remains `AGENTS.md`.

### URL state inside tabs

Tab-internal selection should use query state rather than expanding the route tree again. Examples:

- `?item=<skillName>`
- `?item=<hookName>`
- `?item=<commandId>`
- `?item=<scheduleId>`
- `?doc=<relativePath>`
- `?heading=<slug>`

This keeps route structure small while still supporting back/forward behavior for item selection.

### Legacy route behavior

- `/agents` continues to resolve to `/settings/agent`
- existing in-page detail entry points that currently call `handleEdit()` should navigate to `/settings/agent/:assistantId`
- drawer-only state should not remain the source of truth for which assistant is being viewed

## Page Model

### 1. Agent list page

The list page is the default landing for `/settings/agent`.

It should contain:

- a concise page header with title, description, and primary `Create Agent` action
- a searchable/filterable product-agent list as the primary body
- secondary system-agent summary content that links out to `/settings/system-runs`

The list page should stop pretending to be a mini workbench. Its job is:

- browse assistants
- start creation
- jump into a chosen assistant detail page

Clicking an assistant card opens its detail route. Clicking `Create Agent` opens `/settings/agent/new`.

### 2. Create page

The create page replaces the drawer-based create flow.

It should use a full-page form with sections for:

- identity
  - name
  - description
  - avatar
- runtime
  - main agent/runtime selection
- initial rules
  - prompt/rules content for custom assistants
- optional starter capabilities
  - initial skills
  - initial hooks

Design constraints:

- keep the first implementation close to the current create behavior
- do not invent a template marketplace or multi-step wizard unless the current behavior needs it
- support `duplicate` by pre-filling the same form surface

Successful creation navigates directly to the newly created assistant detail route and resolves the default tab.

### 3. Detail page

The detail page is a full-page workspace with three levels of hierarchy:

1. page header
2. tab bar
3. tab workbench content

#### Page header

The header should carry assistant-level identity and state:

- back action to the Agent list
- avatar
- assistant name
- assistant description
- source badges
  - builtin
  - extension
  - custom
  - package-backed where applicable
- runtime/main agent summary
- enabled status
- package summary chips when available
  - package id
  - counts for capabilities/docs if useful

Header actions:

- `Edit Basics`
- `Duplicate`
- `Enable / Disable`
- `Delete` for deletable assistants only

The header is the durable assistant context that remains while tabs switch.

#### Basics inspector

`Edit Basics` opens an inline inspector panel inside the page, not a modal or drawer floating above the page.

It contains the assistant-level fields that are not part of the package capability tabs:

- name
- description
- avatar
- runtime/main agent
- rules/prompt editor or preview
- enabled state where editable

Behavior by assistant source:

- builtin assistants
  - preserve current product rules
  - keep identity fields read-only where they are read-only today
  - allow runtime/main-agent adjustments only where they are supported today
- extension assistants
  - read-only
  - surface `Duplicate` as the path into editing
- custom assistants
  - fully editable

The inline inspector closes without leaving the detail route. Tab state is preserved.

## Default Detail Landing

Navigating to `/settings/agent/:assistantId` should redirect to the first non-empty tab using this priority:

1. `skills`
2. `hooks`
3. `schedules`
4. `commands`
5. `agents`
6. `docs`

Reasoning:

- `Skills` is the most actionable package capability surface
- `Hooks`, `Schedules`, and `Commands` are operational capability surfaces
- `AGENTS.md` is the packaged rules-entry and orientation layer
- `Docs` is deeper reference material

If the assistant has no package-backed content in any of these tabs:

- still route to the first editable operational tab that the assistant supports
- auto-open the `Basics` inspector for custom assistants so the user lands in an immediately useful state

## Tab Behavior

### Shared rules

- Tabs are rendered in a stable order.
- Tabs from the canonical set may be hidden when the assistant does not expose that surface and the surface is not user-addable.
- For editable custom assistants, empty operational tabs may still be shown so users can add capabilities from empty states.
- Tab switches do not reset the page header or close the basics inspector unless the user explicitly closes it.

## Tab Internal Layout

The detail page should avoid long single-column waterfalls. Tabs should use a workbench layout instead:

- top tab toolbar
- left index/list pane
- right detail/viewer pane

On narrower widths, the left pane collapses into a top segment or selector while preserving the same mental model.

### Skills tab

Purpose:

- show package-owned and attached skills as a navigable capability list
- support add/remove flows for editable assistants

Layout:

- left pane: skill list grouped by source
  - package-owned
  - enabled custom
  - pending/addable
- right pane: selected skill detail
  - summary
  - compatibility/dependency hints
  - preview excerpt
  - actions

Empty state:

- explain what skills do
- offer `Add Skills` for editable assistants

### Hooks tab

Purpose:

- show installed or attached hooks and their execution boundaries

Layout:

- left pane: hook list
- right pane: hook detail and routing/output config summary

Editable assistants can:

- import hook
- remove hook
- adjust hook routing where already supported by current product logic

### Schedules tab

Purpose:

- show assistant-linked schedules as automation assets instead of burying them in raw JSON

Layout:

- left pane: schedule list with status chips
- right pane: schedule detail
  - trigger
  - target/action summary
  - enable state
  - last run / next run summary when available

First implementation may remain mostly read-only if schedule mutation is not already productized for assistants. The UI structure should still reserve the surface.

### Commands tab

Purpose:

- show assistant-linked commands as explicit executable capabilities

Layout:

- left pane: command list
- right pane: command detail
  - description
  - input or invocation summary
  - source path / ownership summary
  - editability state

### `AGENTS.md` tab

`AGENTS.md` is not just another markdown file. It is the packaged rules-entry page.

Layout:

- top contract summary strip
  - package identity
  - supported work
  - capability counts
  - escalation or boundary hints when extractable
- main reader area with rendered markdown
- optional heading outline rail when width allows

Behavior:

- if structured data can be derived from `agent-package.json`, surface it above the markdown
- the markdown body remains readable and scrollable as a document
- heading navigation should jump within the rendered content

For assistants without `AGENTS.md`:

- hide the tab if the assistant is not package-backed
- otherwise show an AGENTS.md rules-entry empty state explaining that the package does not provide a projected rules entry document

### Docs tab

`Docs` must behave like a doc browser.

Layout:

- left pane: document tree
- right pane: rendered document reader
- optional top breadcrumb or file-path bar inside the reader

Default selected document:

1. manifest-declared default doc if available
2. `README.md` in package docs root
3. first readable markdown document in tree order

Behavior:

- expanding folders should not replace the current document until the user chooses one
- the selected document path should sync to query state
- document navigation stays inside the same assistant detail route

If no docs exist:

- hide the tab for assistants with no docs surface
- or show a minimal empty state if the package advertises docs but none are readable

## Entry Points And Transitions

All Agent detail entry points should converge on the same route model.

### In scope

- clicking an assistant in the Agent list
- clicking assistant settings/open actions from the list
- clicking `Create Agent`
- duplicating an assistant
- future internal links that want to open an assistant detail tab directly

### Transition rules

- list -> detail keeps the user inside `/settings/agent/*`
- detail -> list uses browser back when applicable, otherwise the explicit back action
- create success -> detail default tab
- duplicate -> create page prefilled, not direct overwrite

## Responsive Behavior

Desktop is the primary target. The design still needs a narrow-width fallback.

### Desktop

- full right-pane page
- tab workbench with left index + right detail
- optional outline rail for docs or `AGENTS.md`

### Narrow widths

- keep full-page routing
- collapse the left index into a top selector or stacked section
- keep header actions available without modal-first fallback

## Data And Implementation Implications

The renderer will need a normalized assistant workspace model that combines:

- current assistant list metadata
- current editability rules
- package capability presence
- document tree data
- selected-tab and selected-item route state

This should be expressed as a dedicated view-model layer rather than continuing to drive the page from drawer-local state.

## Acceptance Criteria

- `/settings/agent` is a full-page Agent list in the settings content pane.
- `Create Agent` opens `/settings/agent/new` as a full page.
- every Agent detail entry opens `/settings/agent/:assistantId` or `/settings/agent/:assistantId/:tabId`, not a drawer.
- the detail page has canonical tabs for `Skills`, `Hooks`, `Schedules`, `Commands`, `AGENTS.md`, and `Docs` where applicable.
- navigating to `/settings/agent/:assistantId` resolves to the first non-empty tab using the agreed priority.
- detail tabs use structured workbench layouts instead of long waterfall sections.
- `AGENTS.md` is rendered as a contract page, not only as raw text in a form.
- `Docs` is rendered as a document tree plus reader, not as a list of cards.
- builtin, extension, and custom assistants preserve current editability constraints.
- browser back and direct deep links work for list, create, detail, and tab navigation.
