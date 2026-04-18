# Command Management Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a built-in command-management skill plus command control blocks, execution, and message cards so assistants can create, update, and delete Space or project commands through natural language.

**Architecture:** Mirror the existing schedule control-command pattern. Add a builtin skill that teaches the assistant to use structured command blocks, parse and execute those blocks in the assistant message pipeline, persist results through the existing Space and project command storage paths, and emit a new command event card into the conversation stream.

**Tech Stack:** TypeScript, Vitest, React, Electron IPC bridge, existing workspace automation and Space services.

---

### Task 1: Define command event and skill surfaces

**Files:**

- Create: `src/common/types/commands/events.ts`
- Create: `src/process/resources/skills/_builtin/command-management/SKILL.md`
- Modify: `src/common/chat/chatLib.ts`

- [ ] Add a shared command event payload type for `list`, `upsert`, `delete`, and `error`.
- [ ] Add a built-in `command-management` skill that documents scope resolution, create/update/delete rules, and command block formats.
- [ ] Register a `command_event` message type in chat message definitions.

### Task 2: Add command block parsing and execution

**Files:**

- Create: `src/process/services/context/events/AssistantCommandCommandService.ts`
- Modify: `src/process/services/context/events/schedule/AssistantScheduleCommandService.ts`
- Modify: `src/process/bridge/services/workspaceAutomation.ts`

- [ ] Write failing tests for parsing command control blocks and for create/update/delete behavior in Space and project scopes.
- [ ] Implement command block parsing for `[COMMAND_LIST]`, `[COMMAND_UPSERT]...[/COMMAND_UPSERT]`, and `[COMMAND_DELETE: ...]`.
- [ ] Reuse existing `.contextgo/commands.json` and `space.saveCommandLibrary` persistence semantics.
- [ ] Extend assistant control-command stripping so command blocks do not leak into visible assistant text.

### Task 3: Emit and render command event cards

**Files:**

- Create: `src/process/services/context/events/command/CommandEventMessageEmitter.ts`
- Create: `src/renderer/pages/conversation/Messages/command/MessageCommandEvent.tsx`
- Modify: `src/renderer/pages/conversation/Messages/MessageList.tsx`
- Modify: `src/renderer/services/i18n/locales/en-US/conversation.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/conversation.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/conversation.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/conversation.json`

- [ ] Write failing renderer tests for command event cards.
- [ ] Implement a product card that shows scope, slash name, description, and action result.
- [ ] Wire the new message type into the message list.
- [ ] Add i18n strings for create, update, delete, list, and error states.

### Task 4: Wire all assistant runtimes to command execution

**Files:**

- Modify: `src/process/agent/codex/messaging/CodexMessageProcessor.ts`
- Modify: `src/process/task/AcpAgentManager.ts`
- Modify: `src/process/task/GeminiAgentManager.ts`

- [ ] Write failing integration-oriented tests around assistant command execution where coverage already exists.
- [ ] Execute command control blocks in the same post-response phase that currently handles schedules and Skill Market commands.
- [ ] Emit command event messages and feed system responses back to the agent when follow-up is required.

### Task 5: Verify built-in skill availability and documentation

**Files:**

- Modify: `tests/unit/initAgent.skills.test.ts`
- Modify: `src/process/resources/assistant/README.md`

- [ ] Add tests proving the new built-in skill is available through the existing built-in skill surfaces.
- [ ] Update assistant resource docs if the built-in skill inventory is described there.

### Task 6: Final verification and delivery

**Files:**

- Modify: relevant tests only if expectations need updates

- [ ] Run focused tests for command parsing, rendering, runtime execution, and built-in skill exposure.
- [ ] Run `bunx tsc --noEmit`.
- [ ] Run `bun run lint:fix` and `bun run format` if needed on touched files.
- [ ] Commit with a conventional commit message.
- [ ] Create or link the GitHub issue, push the branch, open a PR, add labels, and leave the requested issue/PR comments.
