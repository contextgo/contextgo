# Agent-First IM Publication Design

**Date:** 2026-04-14
**Status:** Approved for implementation

## Overview

Keep the conversation-header `Publish Agent` entry as-is, but redesign `/settings/agent-publish` around the agreed product model:

- `Agent` is the product subject being published
- `IM channels` are reusable shared resources
- `Publish objects` are platform-native IM objects such as WeChat contacts, Feishu direct chats, Feishu groups, and Feishu topics
- internal routing concepts such as `peer`, `scopeKey`, `bindingId`, and `sessionId` must not dominate the main UI

The page should become an Agent-first publication workbench that shows where the current Agent is already published and lets users add more publish objects through a guided flow.

## Product Model

### Agent

An `Agent` is a project-bound capability bundle:

- project context and artifacts
- `AGENTS.md`
- skills
- hooks
- commands
- schedules
- runtime selection such as Codex, Claude Code, Gemini, or OpenCode

The product publishes the Agent, not an arbitrary runtime enum and not a raw conversation.

### Channel Account Instance

A concrete IM channel instance such as:

- one Feishu bot instance
- one WeChat instance
- one Discord bot instance

It owns:

- account identity
- authentication
- platform capabilities
- default delivery policies

It does not own the product’s long-term publication meaning.

### Publish Object

A platform-native business object that users can recognize and publish into.

Examples:

- WeChat contact
- Feishu direct chat
- Feishu group
- Feishu topic

This is the main user-facing publication target.

### Publication

A durable relation:

`Agent -> ChannelAccountInstance -> PublishObject`

Uniqueness rule:

- the same `ChannelAccountInstance x PublishObject` can only bind to one Agent at a time
- one Agent may publish to many publish objects across many channel account instances

### Project Session

Each published object maps to one current active project session at a time.

Rules:

- the publish object remains stable
- the active project session may rotate
- a “new session” action resets the active project session, not the publication relation

### Object-Level Policy

`Publication` is not pure binding. It may carry a very small set of object-level overrides.

The first supported override is:

- whether this publish object requires `@Agent` before the Agent should respond

Policy resolution:

- channel account instance provides defaults
- publication may override selected defaults

## UX Principles

### Keep the existing entry point

The conversation-header `Publish Agent` button remains the entry to `/settings/agent-publish`.

### Make the page Agent-first

The main page must answer:

- what Agent am I publishing?
- where is it already published?
- where else can I publish it?

It should not start with:

- which channel account do I want to inspect?
- which binding row do I want to edit?

### Make publish objects the first-class list item

The main list item should be a recognizable publish object card, for example:

- `Feishu Group · Design Review`
- `Feishu Topic · Release Discussion`
- `WeChat Contact · Alice`

The card may include technical metadata secondarily, but the title and primary labels must stay business-native.

### Keep advanced routing escape hatches secondary

When platform APIs can discover objects, show those native objects directly.
When a platform cannot enumerate objects, or the desired object has not yet been discovered, the page may expose a secondary advanced/manual path.

That manual path is implementation detail support, not the primary product story.

## Target Page Structure

### 1. Agent summary header

Show:

- Agent name
- runtime/backend
- workspace/project
- source conversation provenance when entered from a conversation

The summary should explain that the page manages where this Agent is published.

### 2. Published objects list

Default page body.

Show only publish objects already bound to the selected Agent.

Each row/card should display:

- publish object title
- platform-native object type
- channel account instance name
- parent object if relevant, such as a topic’s parent group
- publication status
- current active session status in plain product language
- object-level mention policy summary when applicable
- edit and unpublish actions

Do not show raw `bindingId`, `scopeKey`, or `conversationId` as primary UI.

### 3. Add publish object action

The default page should not keep the full object pool visible.
Instead, show a primary `Add Publish Object` action.

### 4. Add publication flow

When the user starts adding:

1. choose a channel account instance
2. choose a platform-native publish object under that instance
3. optionally override the mention-response policy
4. confirm publication

If no publish objects are available from discovery for that channel instance, the flow may expose a manual advanced path.

## Current-Code Problems To Correct

The current `/settings/agent-publish` implementation is still channel-first:

- the page starts from channel account selection
- object inspection is framed as a channel-object operations console
- add-publication controls are mixed into the same object operations area
- the main mental model is still close to `channel binding catalog`

This mismatch causes product confusion because the page is entered from “Publish Agent”, but the page behaves like “Manage channel bindings”.

## Implementation Scope

This implementation slice should focus on the renderer publication page and the existing bridge data.

In scope:

- redesign `/settings/agent-publish` into an Agent-first page
- reuse current `publicationIntent` restoration from conversation entry
- show published objects grouped by selected Agent
- add an add-publication flow that starts with Agent context, then selects account and publish object
- surface a minimal object-level mention policy UI if the current data model can already support it, otherwise leave the UI hook prepared and keep persistence for a follow-up

Out of scope for this slice:

- replacing the underlying storage model
- shipping platform-specific object enumeration APIs
- reworking temporary handoff / current-session continuation UX
- adding full per-object command exposure controls

## Acceptance Criteria

- Entering from the conversation-header `Publish Agent` button still opens `/settings/agent-publish`.
- The page defaults to the Agent inferred from the entry conversation when available.
- The main body initially shows only publish objects already published for that Agent.
- Publish-object cards are labeled with platform-native object names and types, not technical routing identifiers.
- Adding a publication starts from `Add Publish Object`, then channel instance, then publish object.
- Existing durable publication editing and deletion still work.
- The page no longer leads users through a channel-first workflow as the primary interaction.
