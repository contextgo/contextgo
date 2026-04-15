# Group V1 Single Orchestration Plan

> For agentic workers: implement this plan inline in this session. The target is issue #161 after scope reduction: `Group` remains the product object, and v1 exposes one fixed orchestration only.

**Goal:** Ship a Group-first v1 that removes workflow and mode selection from the user path, keeps single-Agent publication untouched, and makes the Group chat surface read as a real multi-agent collaboration view.

**Architecture:** Preserve the existing parent-group plus hidden-child conversation chassis. Reduce the create flow to one fixed discussion-backed orchestration, add a renderer-level overview surface for participants and synthesis, and extend the discussion runtime to emit round summaries and a final synthesis message without reintroducing workflow concepts into the main path.

**Tech Stack:** React, Arco Design, Electron IPC bridge, Vitest 4

---

## File Map

- Modify: `src/renderer/pages/conversation/platforms/group/CreateGroupModal.tsx`
- Modify: `src/renderer/pages/conversation/utils/createConversationParams.ts`
- Modify: `src/process/bridge/services/group/discussion/DiscussionGroupRuntime.ts`
- Modify: `src/process/bridge/services/group/discussion/discussionHelpers.ts`
- Modify: `src/renderer/pages/conversation/platforms/group/GroupChat.tsx`
- Modify: `src/renderer/services/i18n/locales/zh-CN/conversation.json`
- Modify: `src/renderer/services/i18n/locales/en-US/conversation.json`
- Create: `src/renderer/pages/conversation/platforms/group/GroupOverviewCard.tsx`
- Delete: `src/renderer/pages/conversation/platforms/group/CreateDiscussionGroupModal.tsx`
- Delete: `src/renderer/pages/conversation/platforms/group/HarnessRunSummaryCard.tsx`
- Test: `tests/unit/createConversationParams.test.ts`
- Test: `tests/unit/group/GroupConversationService.test.ts`
- Test: `tests/unit/renderer/workspace/GroupParticipantsPanel.dom.test.tsx`
- Create: `tests/unit/renderer/chat/GroupOverviewCard.dom.test.tsx`
- Delete or replace: `tests/unit/renderer/chat/HarnessRunSummaryCard.dom.test.tsx`

## Task 1: Simplify Group creation to one fixed orchestration

- Remove workflow and discussion-mode controls from the create modal.
- Keep only group name, workspace, and participant selection.
- Build new groups through one fixed discussion-backed orchestration with at least two participants.
- Preserve internal orchestration typing, but stop exposing workflow creation from the main user path.

## Task 2: Replace legacy Group surface with a Group overview card

- Remove the harness summary card from the main Group chat path.
- Add a Group overview card that shows participants, current run state, fixed collaboration copy, latest round summary, and final synthesis when present.
- Keep speaker-level message projection in the timeline.

## Task 3: Add runtime-emitted round summary and final synthesis

- After each discussion round, persist one synthetic summary message in the parent group timeline.
- After all rounds complete, persist one final synthesis message in the parent group timeline.
- Keep the implementation deterministic and renderer-friendly so the overview card can surface the latest summary without adding new database tables.

## Task 4: Remove legacy main-path files and update tests

- Delete the unused `CreateDiscussionGroupModal.tsx`.
- Delete the harness summary card and its dedicated renderer tests.
- Update or add tests for simplified create params, discussion runtime summary projection, and the new overview card.

## Verification

- `bun run test tests/unit/createConversationParams.test.ts`
- `bun run test tests/unit/group/GroupConversationService.test.ts`
- `bun run test tests/unit/renderer/workspace/GroupParticipantsPanel.dom.test.tsx`
- `bun run test tests/unit/renderer/chat/GroupOverviewCard.dom.test.tsx`
- `bunx tsc --noEmit`
- If the targeted suite passes cleanly, run `bun run test` if time permits to confirm no unrelated regressions.
