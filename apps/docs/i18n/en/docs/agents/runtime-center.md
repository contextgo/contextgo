---
title: Runtime Center
slug: /agents/runtime-center
description: See installation, sign-in, config, health, and external-session status for Gemini, Claude Code, Codex, and OpenCode.
---

# Runtime Center

Runtime Center is the main place to understand runtime status inside ContextGo.

It does not only answer "which runtimes are supported."  
It separates the states that actually matter in practice:

- whether the CLI was discovered
- whether auth or config exists
- whether the runtime can really start
- whether there are external sessions ready to be taken over

## What Runtime Center is checking

The current product-visible runtime set is:

- Gemini
- Claude Code
- Codex
- OpenCode

ContextGo does not move these runtimes into the project, and it does not treat `.contextgo/` as a runtime-owned home.

The more accurate model is:

- ContextGo reads runtime-native global state
- ContextGo projects only the runtime workspace surfaces it actually needs
- ContextGo keeps its own workspace metadata inside `.contextgo/`

## Runtime detection flow

Today the product effectively evaluates runtime availability in four layers.

### 1. Discover the CLI

ContextGo first tries to find the executable:

- on macOS and Linux it prefers `which`
- on Windows it prefers `where`, then falls back to PowerShell `Get-Command`
- it merges login-shell environment data so PATH works even when the desktop app was launched outside a terminal
- any saved manual path override is also considered

This layer answers:

- does this host have a runnable entrypoint for the runtime

### 2. Inspect config and auth locations

ContextGo also knows the common config and auth locations for each runtime, so it can show:

- where config probably lives
- where auth troubleshooting should start

This still does not mean the runtime is ready.  
It only exposes the right debugging surface.

### 3. Run a real health check

Ready does not mean "it looks installed."

The health check in Runtime Center performs an actual start or handshake attempt.  
That is much closer to the real question:

- can this host launch the runtime now
- are auth and config good enough for execution

### 4. Discover external sessions

If a runtime already has native sessions on the machine, ContextGo also scans for those session signals to answer:

- are there existing sessions available for takeover
- can the current workspace continue with existing context instead of starting from zero

## Installed, signed in, and ready are different states

The most important thing Runtime Center does is prevent these states from collapsing into one vague "connected" badge.

- Installed / Detected
  - the executable was found
- Signed In / Configured
  - credentials or config are present
- Ready
  - the current host and workspace can actually execute now

There is a dedicated page for this distinction:

- [Installed, Signed In, Ready](./installed-signed-in-ready)

## Managed install inside ContextGo

The current "install locally" action follows one shared product path:

- click install in the product
- let the desktop host run `npm install -g ...`
- refresh runtime detection immediately after installation

That path currently works the same way across macOS, Linux, and Windows, with explicit boundaries:

- it depends on Node.js and npm already existing on the host
- it does not yet switch to `brew`, `apt`, `winget`, or `choco`
- it installs the CLI, but it does not replace later sign-in, config, or model-selection work

Managed install is currently available for:

- Gemini
- Claude Code
- Codex
- OpenCode

## How each runtime appears in ContextGo

### Gemini

- CLI command: `gemini`
- Common user config: `~/.gemini/settings.json`
- External session discovery signal: `~/.gemini/tmp/.../chats/session-*.json`
- Managed install in ContextGo: supported
- Official docs:
  - [Gemini CLI Docs](https://geminicli.com/docs/)
  - [Installation](https://geminicli.com/docs/get-started/installation/)
  - [Authentication](https://geminicli.com/docs/get-started/authentication/)
  - [GitHub Repository](https://github.com/google-gemini/gemini-cli)

### Claude Code

- CLI command: `claude`
- Common user config: `~/.claude/settings.json`
- External session discovery signal: `~/.claude/projects/**/*.jsonl`
- Managed install in ContextGo: supported
- Official docs:
  - [Claude Code Quickstart](https://code.claude.com/docs/en/quickstart)
  - [Claude Code Settings](https://code.claude.com/docs/en/settings)
  - [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows)

### Codex

- CLI command: `codex`
- Common user config: `~/.codex/config.toml`
- Common auth file: `~/.codex/auth.json`
- External session discovery signal: `~/.codex/state_*.sqlite`
- Managed install in ContextGo: supported
- Official docs:
  - [OpenAI Codex CLI](https://developers.openai.com/codex/cli)
  - [Codex GitHub Repository](https://github.com/openai/codex)

### OpenCode

- CLI command: `opencode`
- Common config and state roots:
  - `~/.config/opencode/`
  - `~/.local/share/opencode/`
- External session discovery signal: native `opencode.db`
- Managed install in ContextGo: supported
- Official docs:
  - [OpenCode CLI Docs](https://opencode.ai/docs/cli/)

## How ContextGo differs from the official runtimes

If you read only the vendor docs, you will mostly see each runtime's own CLI, config, sessions, and native workflow.

ContextGo adds a product layer above that:

- **External session takeover**
  - discover and import existing runtime sessions without requiring a manual export step
- **Context Engine**
  - manage context through session, project, space, memory, and governance models instead of only one CLI's local history
- **Context Connector**
  - bring in external context from files, the web, collaboration tools, knowledge systems, and business systems
- **IM publishing**
  - publish Agents to Telegram, Slack, Lark, Discord, and similar surfaces while keeping the same context and capability package
- **Agent Packages / Skills / Hooks / Commands / Schedules**
  - provide product-owned capability layers on top of runtimes instead of treating third-party workspace layout as the product boundary

## When to open the external-session page

If your real question is not "how do I install this," but rather:

- I already have sessions in the official CLI
- I want to continue them in ContextGo
- I do not want to manually export and restart everything

then the next page is:

- [External Session Takeover](./external-session-takeover)

## Next

- For state differences: [Installed, Signed In, Ready](./installed-signed-in-ready)
- For session continuation and import: [External Session Takeover](./external-session-takeover)
- For the builder workflow: [Coding And Builder Workflow](../use-cases/coding-and-builder-workflow)
