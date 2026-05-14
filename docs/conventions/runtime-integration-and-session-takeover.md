# Runtime Integration And Session Takeover

This document complements:

- [docs/conventions/runtime-boundary.md](./runtime-boundary.md)
- [docs/conventions/runtime-support.md](./runtime-support.md)

It focuses on how ContextGo integrates supported runtimes at the product level, especially for detection, managed install, configuration surfaces, and external session takeover.

## Supported Product Runtime Set

The current product-visible coding runtime set remains:

- `gemini`
- `claude`
- `codex`
- `opencode`

These are the runtimes that may appear in:

- Runtime Center
- assistant runtime recommendations
- external session takeover UI
- runtime configuration surfaces

## Detection Flow

Runtime detection in the current product is layered. It should be described in this order:

### 1. CLI discovery

Primary implementation anchors:

- `src/process/agent/acp/AcpDetector.ts`
- `src/process/utils/shellEnv.ts`

Current rules:

- prefer `which` on macOS / Linux
- prefer `where` on Windows, with PowerShell `Get-Command` fallback
- merge login-shell environment so Finder / launchd launches still get the user's PATH and auth-related env vars
- allow a saved manual CLI path override to participate in the effective runtime path

Important:

- detection is not the same as readiness
- detection only answers whether the product can find a plausible runtime entrypoint

### 2. Config and auth surface inspection

Primary implementation anchor:

- `src/process/bridge/acpConversationBridge.ts`

The product may surface common config or auth file locations for the runtime, for example:

- Gemini: `~/.gemini/settings.json`
- Claude Code: `~/.claude/settings.json`
- Codex: `~/.codex/config.toml`, `~/.codex/auth.json`
- OpenCode: native config / auth directories under the runtime's own app-data roots

Rules:

- these files remain runtime-native global state
- ContextGo may reveal or edit them
- ContextGo must not re-home them into `.contextgo/`

### 3. Health check

Primary implementation anchor:

- `src/process/bridge/acpConversationBridge.ts`

Ready must be based on an actual launch or handshake attempt, not only discovery.

That check is the closest product meaning of:

- this runtime can start now
- this host and workspace can actually execute through it

## Managed Install Boundary

Current managed-install capability is product-owned but intentionally narrow.

Primary implementation anchors:

- `src/common/types/acpTypes.ts`
- `src/process/bridge/acpConversationBridge.ts`
- `src/renderer/pages/settings/AgentSettings/CustomAcpAgent.tsx`

Current product behavior:

- the Runtime Center install action runs a host-side `npm install -g ...`
- after install, ContextGo refreshes runtime detection immediately
- this is shared across macOS, Linux, and Windows

Current managed-install runtime set:

- `gemini`
- `claude`
- `codex`
- `opencode`

Important boundaries:

- this flow depends on Node.js and npm already existing on the host
- it is not yet a platform-native package-manager abstraction
- do not describe it as `brew` / `apt` / `winget` / `choco` integration
- install support does not imply auth, config, or model policy is complete

## External Session Takeover Boundary

Primary implementation anchors:

- `src/process/bridge/services/ExternalSessionDiscoveryService.ts`
- `src/process/bridge/services/externalSessionBootstrap/index.ts`

When ContextGo discovers or imports external sessions, it must read runtime-native global state, not project mirrors.

Current native discovery sources include:

- Claude Code session JSONL under `~/.claude/projects/`
- Codex thread state under `~/.codex/state_*.sqlite`
- Gemini CLI chat history under `~/.gemini/tmp/.../chats/`
- OpenCode native `opencode.db`

Rules:

- do not mirror these stores into `.contextgo/` just to enable discovery
- do not invent project-owned runtime history databases
- imported sessions become ContextGo conversations, but the source runtime state remains native and user-owned

## Product-Owned Layers Above The Runtime

The runtime is only one layer in the product model.

ContextGo additionally owns:

- Context Engine
  - session / project / space / memory / governance
- Context Connector
  - external context ingestion and access
- IM publication
  - Telegram / Slack / Lark / Discord and similar surfaces
- Agent Package projection
  - `AGENTS.md`, `skills`, `hooks`, `commands`, `schedules`

Rules:

- do not collapse these product capabilities into runtime-native directory semantics
- do not treat a vendor CLI workspace layout as the product boundary
- keep runtime-native directories as projections only where documented and necessary

## Messaging Rule

When explaining this system internally or externally, use this structure:

1. the runtime provides execution
2. Runtime Center shows detection, install, config, readiness, and takeover availability
3. external session takeover brings native conversations into ContextGo
4. ContextGo then layers context governance, connectors, automation, and publishing above that runtime

Avoid describing ContextGo as only a launcher around third-party CLIs. That is materially incomplete.
