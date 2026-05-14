---
title: Audiences, Threads, Groups
slug: /publish/audiences-threads-groups
description: Publishing is not one bot to one chat. ContextGo routes by audience, group, topic, or thread.
---

# Audiences, Threads, Groups

Inside a channel, the important service target is not only "the platform".

## Why this page matters

If you only focus on the platform itself, you quickly run into three problems:

- one platform often contains several different service targets
- different topics inside one group may need different capabilities
- who an agent serves changes its input, output, and permission boundary

So the real model is not "which platform are we on", but "who exactly are we serving".

## Separate the layers first

It is more often:

- an audience
- a group
- a topic
- a thread

You can treat the layers like this:

- `Channel` is the external channel type
- `Account / Instance` is the real account or instance carrying the entry
- `Audience / Group` is the human or organizational service target
- `Topic / Thread` is the narrower interaction context

## Why this matters

Real publication problems are about:

- who is being served
- which entry point maps to which audience
- whether different threads should use different published capabilities

## A safer modeling order

Do not make everything complex on day one.

The safer order is:

1. define one clear audience
2. define where that audience is mainly served
3. only add topic or thread routing if the platform really needs it
4. split capabilities only when inputs or outputs genuinely differ

## Common routing patterns

Stable patterns often include:

- one agent for one clear audience
- different groups inside one channel mapped to different published capabilities
- different topic or thread routes for different task flows
- one shared agent adapting based on thread context

You do not need maximum routing complexity to have a valid publish model.

## A simple mental model

In plain terms:

- Channel is the channel
- Account is the entry identity
- Audience / Group / Thread are the service targets

## Common misunderstandings

- "If the platform is connected, the service target is already obvious."
- "Everything inside one group should use the same capability."
- "A thread is only a message format detail."

Those assumptions lead to routing confusion later.

## Next

- [Channels](/publish/channels)
- [Channel Accounts And Instances](/publish/channel-accounts-and-instances)
- [Publish One Agent To Many Places](/publish/publish-one-agent-to-many-places)
- [Managing Published Agents](/publish/managing-published-agents)
