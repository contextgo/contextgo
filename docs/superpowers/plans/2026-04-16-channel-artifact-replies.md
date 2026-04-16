# Channel Artifact Replies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let IM-published agents return a generated local artifact as a channel file reply through a shared gateway policy, with Weixin as the first validated transport.

**Architecture:** Extend the existing `.contextgo/channels/` publication model with a project-owned reply policy, add a shared artifact reply shape in the channel gateway path, and map a minimal single-file artifact reply into `IUnifiedOutgoingMessage`. Keep Weixin-specific upload/send logic inside the Weixin plugin/monitor and keep fallback behavior in the shared gateway.

**Tech Stack:** TypeScript, Vitest, channel gateway/publication services, Weixin plugin monitor.

---

### Task 1: Model Project-Owned Reply Policy In Existing Channel Publication State

**Files:**

- Modify: `src/process/channels/types.ts`
- Modify: `src/process/channels/core/ProjectChannelPublicationService.ts`
- Test: `tests/unit/channels/projectChannelPublicationService.test.ts` (create if missing)

- [ ] Add channel reply policy types to `src/process/channels/types.ts`.
- [ ] Extend `IAgentProfile` with an optional `channelReplyPolicy` object that can declare allowed reply capabilities and fallback mode.
- [ ] Normalize the new policy in existing `normalizeAgentProfiles()` flow so missing values are stable.
- [ ] Add/extend a unit test that proves `ProjectChannelPublicationService.readSnapshot()` round-trips the new policy from `.contextgo/channels/agent-profiles.json`.
- [ ] Run targeted test for the publication service model.

### Task 2: Define Shared Artifact Reply Shape In The Channel Gateway Layer

**Files:**

- Modify: `src/process/channels/agent/ChannelMessageService.ts`
- Modify: `src/process/channels/gateway/ActionExecutor.ts`
- Modify: `src/process/channels/types.ts`
- Test: `tests/unit/channels/channelMessageService.test.ts`

- [ ] Add a minimal shared artifact reply shape for channel-published agents, scoped to a single outgoing artifact for v1.
- [ ] Keep existing text reply behavior unchanged when no artifact is present.
- [ ] Extend the channel message flow so the gateway can receive both display text and an optional artifact reply candidate.
- [ ] Add tests that prove the agent-facing path can carry a file artifact candidate without breaking existing text-only behavior.
- [ ] Run targeted channel message service tests.

### Task 3: Map Shared Artifact Replies Into Unified Outgoing Messages

**Files:**

- Modify: `src/process/channels/gateway/ActionExecutor.ts`
- Modify: `src/process/channels/types.ts`
- Test: `tests/unit/channels/actionExecutor.test.ts` (create if missing)

- [ ] Add gateway logic that reads the resolved `agentProfile.channelReplyPolicy` and decides whether a file artifact may be sent.
- [ ] If allowed, map the artifact to `IUnifiedOutgoingMessage { type: 'file', fileUrl, fileName }`.
- [ ] If disallowed or unsupported, fall back to text behavior using the configured fallback mode.
- [ ] Add a test covering the allowed-file path and a test covering fallback-to-text-path behavior.
- [ ] Run targeted action executor tests.

### Task 4: Validate Weixin Transport As The First Artifact Reply Implementation

**Files:**

- Modify: `src/process/channels/plugins/weixin/WeixinPlugin.ts` (only if bridge shape needs minor adaptation)
- Modify: `src/process/channels/plugins/weixin/WeixinMonitor.ts` (only if monitor reply shape needs minor adaptation)
- Test: `tests/unit/channels/weixinPlugin.test.ts`
- Test: `tests/unit/channels/weixinMonitor.test.ts`

- [ ] Keep Weixin transport ownership limited to upload/send behavior.
- [ ] Verify the existing bridge still accepts `type: 'file'` and emits `response.media` correctly.
- [ ] Add or update tests that prove a generated local document can be emitted as Weixin outbound file media through the shared gateway path.
- [ ] Run targeted Weixin plugin/monitor tests.

### Task 5: Verify And Prepare Review Artifacts

**Files:**

- Modify: `docs/superpowers/specs/2026-04-16-channel-artifact-replies-design.md` (create concise spec snapshot if needed)
- Modify: `docs/superpowers/plans/2026-04-16-channel-artifact-replies.md`

- [ ] Write a concise spec snapshot describing the accepted direction and the minimal v1 scope.
- [ ] Run verification commands:
  - `./node_modules/.bin/vitest run tests/unit/channels/channelMessageService.test.ts tests/unit/channels/weixinPlugin.test.ts tests/unit/channels/weixinMonitor.test.ts --reporter=verbose`
  - `bunx tsc --noEmit`
  - `bunx oxfmt --check <touched-files>`
  - `bunx oxlint <touched-files>`
- [ ] Commit on the feature branch with an English conventional commit.
- [ ] Push the worktree branch and open a PR linked to issue `#169`.
- [ ] Comment on issue `#169` with the PR URL and verification summary.
