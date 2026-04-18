<p align="center">
  <img src="./resources/contextgo_readme_header_0807.png" alt="ContextGo" width="100%">
</p>

<p align="center">
  <img src="./resources/contextgo_logo_no_border.png" alt="ContextGo Logo" width="120">
</p>

<p align="center">
  <strong>The next AI-native workbench</strong><br>
  A product system that brings frontier models, code agents, project context, connectors, and remote collaboration into one working loop.
</p>

<p align="center">
  <a href="./readme.md">中文</a> ·
  <a href="https://github.com/contextgo/contextgo/releases">Downloads</a> ·
  <a href="https://contextgo.io">Website</a>
</p>

---

## What ContextGo Is

ContextGo is not another chat shell, and it is not just a desktop textbox wrapped around model APIs.

It is an AI-native workbench built to solve a harder problem: **how to keep agents useful over long-running work inside real projects, without losing control, polluting context, or breaking away from the user's actual workflow.**

For end users, ContextGo is a next-generation AGI assistant that can genuinely help get work done.

For developers and teams, it is a full product system that combines `project`-based work, Agent harnessing, context governance, connectors, remote access, and multi-device surfaces.

In one sentence:

> **Code agents are not limited to code. With a stable harness, durable context, and real connectors, they can build anything.**

---

## The Problem It Solves

Frontier models are already strong, but long-duration agent work still breaks down in familiar ways:

- the model can reason, but long tasks drift without a stable control system
- project knowledge, personal preferences, success patterns, and failure patterns do not accumulate cleanly
- AI remains disconnected from software, documents, IM channels, browsers, and local files
- cross-device, cross-session, and cross-project usage is still high-friction
- ordinary users care about one thing: whether the agent can actually do useful work

ContextGo turns those problems into one coherent work system.

---

## Core Concepts

### 1. Harness Agent

Harness Agent is the narrow qualifier behind the ContextGo view of agents.

The point is not to invent another model. The point is to add a **constraint, disclosure, and governance layer** around frontier models so long-running human-agent collaboration, or even pure agent execution, can stay ordered instead of becoming chaotic.

That layer is built around a few stable objects:

- `project`: work always happens inside a project directory
- `AGENTS.md`: the rules entry point and progressive-disclosure root
- `docs/`: deeper background, policy, and domain knowledge
- `skills/`: executable task-shaped context
- `hooks`, `commands`, and `schedules`: automation surfaces and shortcut actions

The model handles reasoning and tool use. The harness keeps it controllable inside real work.

### 2. Agent Group

A single agent can already work for a long time, but not every problem should be solved by one agent in one thread.

ContextGo's Agent Group model is intentionally simple and efficient rather than heavy orchestration:

- a planner aligns the direction
- generators keep producing
- evaluators keep judging
- multiple agents can research in parallel, cross-check, and race toward better decisions

The goal is not orchestration for its own sake. The goal is higher-quality output from multiple harnessed agents.

### 3. Context Engine

Context Engine is the stabilizer behind ContextGo.

It is a local-first context engine that continuously organizes, extracts, updates, and governs the high-value signals generated during agent work. It is not just a chat archive, and it is not just traditional vector-only RAG.

It is responsible for:

- extracting durable preferences, working style, success patterns, and failure patterns
- reducing entropy and cleaning polluted project context
- supporting cross-session and cross-project logical spaces through `context space`
- refining and compressing context while the user is away, then feeding it back into later work

### 4. Context Connector

An actually useful agent does not just answer well. It **connects into your existing workflow and can publish back into that workflow.**

Context Connector is the layer that makes that possible:

- it connects knowledge sources, documents, browsers, local files, and external products
- it bridges work channels such as Feishu, Telegram, Slack, WeChat, and DingTalk
- it lets the agent both consume context and return results to the original flow

This is how ContextGo reduces the copy-paste gap between AI and the rest of the software stack.

### 5. Host / Client

ContextGo uses a `Host Runtime + Client Shell` model by default:

- the `Host` is the real execution authority for tools, files, browsers, and long-running tasks
- the `Client` is the remote access and control surface, whether desktop, browser, or phone

In practice:

- desktop remains the primary execution host
- mobile is a natural remote control client
- remote access reuses the same WebUI / server runtime
- the Host can live on macOS, Windows, Linux, and eventually cloud machines

---

## What You Can Do With It

- collaborate with agents inside a real software or knowledge project over time
- connect documents, browsers, local files, cloud services, and work channels
- keep agents researching, organizing, producing, and feeding results back
- start work on desktop and supervise or redirect it from browser or phone
- build your own assistants, skill bundles, and automation flows
- make your agents learn you over time instead of restarting from zero every session

---

## The Product Surface

At the product layer, ContextGo turns those ideas into a usable workbench:

- built-in agents and Agent Packages
- composable skills, hooks, commands, and schedules
- project-level harness bootstrapping
- multi-device access and remote control
- publishing and interaction back into IM and operational channels
- an expanding set of local tools, browser actions, and external integrations

It is designed both for developers and for users who do not care about the internals and only want an agent that can actually work.

---

## ContextGo Product Matrix

| Repository                                                              | Role                                                                                                                            |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| [`contextgo`](https://github.com/contextgo/contextgo)                   | Main product and brand repository covering desktop, WebUI, mobile shell, Agent Packages, Context Engine, and the core workbench |
| [`connector`](https://github.com/contextgo/connector)                   | The connector and controlled-execution boundary for external products, browsers, local resources, and tool operations           |
| [`skillmarket`](https://github.com/contextgo/skillmarket)               | Skill discovery, mirroring, curation, bundling, and distribution infrastructure                                                 |
| [`contextgo-releases`](https://github.com/contextgo/contextgo-releases) | Public release and distribution endpoint for installers, manifests, updater metadata, and exported public content               |

---

## Quick Start

### As a user

1. Download the right build from [Releases](https://github.com/contextgo/contextgo/releases)
2. Launch ContextGo and choose your local Host or remote access path
3. Start your agent workflow inside a project directory

### As a developer

```bash
bun install
bun run start
```

Common development commands:

```bash
bun run webui
bun run test
bun run lint:fix
bun run format
bunx tsc --noEmit
```

---

## Architecture Entry Points

If you want the current product model in more detail, start here:

- [Architecture Overview](./docs/tech/architecture.md)
- [Context Engine Event Architecture](./docs/tech/context-engine-event-architecture.md)
- [Space Product Model](./docs/tech/space-model.md)
- [Mobile / Remote Access Model](./docs/tech/mobile-remote-control.md)
- [Release / Distribution Standards](./docs/tech/release-distribution-standards.md)
- [Agent Package Architecture](./docs/tech/agent-package-architecture.md)

---

## Open Source Status

ContextGo is advancing three things together:

- productized agents
- governed context
- connected software workflows

That makes it both a usable product and a fast-moving open-source system. Some parts are already stable, some are still evolving, but the direction is consistent:

- agents should not be limited to chat
- context should not be reduced to raw history
- software should be designed for both humans and agents

---

## Community

- Website: <https://contextgo.io>
- GitHub: <https://github.com/contextgo/contextgo>
- Releases: <https://github.com/contextgo/contextgo/releases>
