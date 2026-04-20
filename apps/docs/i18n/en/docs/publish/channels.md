---
title: Channels
slug: /publish/channels
description: Channels are the publication and routing layer for exposing agents to external audiences.
---

# Channels

In ContextGo, Channels should not be understood as only a bot settings page.

They are better understood as:

- the publication layer
- the audience routing layer
- the operations layer for external agent entry points

![ContextGo IM channel list](/brand/product/im-channels.png)

Public docs should show the real external entry surfaces first instead of starting from protocol details.

## What a channel solves

Once an agent can work reliably locally, you still need to answer:

- where it is reached from
- where results are delivered
- whether multiple entry points share the same capability

That is the job of Channels.

## Channel differences are not only about protocol

What looks like "one channel" usually also implies:

- account and instance boundaries
- audience scope
- group or thread structure
- interaction and message constraints

So a channel is not just a webhook setting.

## A more stable way to think about it

Treat a channel as an external entry-point definition, not only a technical connection.

It should answer at least four things:

1. where the user enters
2. how input reaches the agent
3. how results come back
4. where the permission boundary sits

## How to start safely

The first phase should stay conservative:

1. connect one channel
2. bind it to one clear scenario
3. serve one explicit audience
4. expand later

## How to choose the first channel

Pick one where:

- the audience is clear
- the input is relatively structured
- the output quality is easy to judge
- the permission boundary is controllable

## Common misunderstandings

- "If messages can be sent, the channel is already defined."
- "If a bot token or webhook exists, the channel design is done."
- "A channel is only about technical protocol, not audience or operations."

None of those are strong enough.

## Stronger public wording

Public docs should emphasize:

- scenario
- audience
- input and output structure
- permissions and operational boundaries

not only a list of supported protocols.

## Next

- For the publication layer: [Publish](/publish)
- For audience structure: [Audiences, Threads, Groups](/publish/audiences-threads-groups)
- For a real workflow: [Publish-To-Channel Workflow](/use-cases/publish-to-channel-workflow)
