# Context Engine Phase 2 Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `#125`, `#127`, `#132`, `#134`, and `#137` in one branch/PR by extending the current three-identity, dual-loop governance runtime through main-process implementation, observability projection, and the minimum renderer closure needed to make the features operational and reviewable.

**Architecture:** Keep the current Context Engine shape and extend it in four internal batches: governance contract core, compression/extraction/profile operations, usage evidence plus connector provenance, and renderer/product closure. All new behavior must stay under the existing steward/curator runtime, trigger model, and agent-package-based capability surface; no parallel memory, recall, or governance subsystem may be introduced.

**Tech Stack:** TypeScript, Vitest, Electron main-process services, renderer settings pages, GitHub issue-driven delivery

---

### Task 1: Formalize the remaining governance lifecycle contract (`#134`)

**Files:**

- Modify: `src/process/services/context/contextDomain.ts`
- Modify: `src/process/services/context/events/types.ts`
- Modify: `src/process/services/context/events/triggers/types.ts`
- Modify: `src/process/services/context/events/triggers/builtinTriggers.ts`
- Modify: `src/process/services/context/events/ContextTriggerRouter.ts`
- Modify: `src/process/services/context/ContextRuntimeService.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`

- [ ] **Step 1: Extend failing tests for the missing contract coverage**

Add focused tests for:

```ts
- delegation/compression lifecycle sequencing
- trigger payload guardrails
- manual/timer/hook/lifecycle parity for steward/curator jobs
- no duplicate governance-routing path outside ContextTriggerRouter
```

- [ ] **Step 2: Run focused tests to confirm current gaps**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
```

Expected: failing assertions that reveal lifecycle contract coverage gaps.

- [ ] **Step 3: Implement the contract extensions in the existing runtime path**

Implementation requirements:

```ts
- keep ContextTriggerRouter as the single governance-routing owner
- formalize turn/session/compression/delegation event envelopes
- preserve current trigger classes (`hook`, `lifecycle`, `timer`, `manual`, `connector`, `derived`)
- keep ContextRuntimeService as an event producer, not a job-creation side path
```

- [ ] **Step 4: Re-run focused verification**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/process/services/context/contextDomain.ts \
  src/process/services/context/events/types.ts \
  src/process/services/context/events/triggers/types.ts \
  src/process/services/context/events/triggers/builtinTriggers.ts \
  src/process/services/context/events/ContextTriggerRouter.ts \
  src/process/services/context/ContextRuntimeService.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts
git commit -m "feat(context): complete governance lifecycle contract"
```

### Task 2: Formalize Session Steward compression and profile operations (`#137`, `#125`)

**Files:**

- Modify: `src/process/services/context/ContextJobOrchestrator.ts`
- Modify: `src/process/services/context/jobs/SessionCompactionJobHandler.ts`
- Modify: `src/process/services/space/SpaceVaultContextSyncService.ts`
- Modify: `src/process/services/context/ContextRuntimeService.ts`
- Modify: `src/process/bridge/services/ActivitySnapshotBuilder.ts`
- Modify: `tests/unit/context-engine/contextJobOrchestrator.test.ts`
- Modify: `tests/unit/process/services/spaceVaultContextSyncService.test.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`

- [ ] **Step 1: Add failing tests for compaction protocol and profile-operation semantics**

Add tests for:

```ts
- explicit compression provenance on timeline / working context / checkpoints
- budget / summary / handoff metadata emitted by Session Steward
- profile operation state transitions distinct from candidate extraction
- contradiction / temporal update / review paths wired into the current governance jobs
```

- [ ] **Step 2: Run focused compaction tests to confirm current behavior is incomplete**

Run:

```bash
bun run test -- tests/unit/context-engine/contextJobOrchestrator.test.ts tests/unit/process/services/spaceVaultContextSyncService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts
```

Expected: FAIL on missing protocol/provenance/state-transition assertions.

- [ ] **Step 3: Implement the minimum complete compaction + profile operation flow**

Implementation requirements:

```ts
- formalize compaction invariants and provenance in existing steward artifacts
- keep the session artifact triad (`timeline`, `working context`, `checkpoints`) as the only session surface
- express profile operations under the current steward/curator jobs rather than a parallel memory runtime
- keep candidate/profile/durable-state boundaries explicit
```

- [ ] **Step 4: Re-run focused verification**

Run:

```bash
bun run test -- tests/unit/context-engine/contextJobOrchestrator.test.ts tests/unit/process/services/spaceVaultContextSyncService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/process/services/context/ContextJobOrchestrator.ts \
  src/process/services/context/jobs/SessionCompactionJobHandler.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  src/process/services/context/ContextRuntimeService.ts \
  src/process/bridge/services/ActivitySnapshotBuilder.ts \
  tests/unit/context-engine/contextJobOrchestrator.test.ts \
  tests/unit/process/services/spaceVaultContextSyncService.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts
git commit -m "feat(context): formalize compaction and profile operations"
```

### Task 3: Add usage evidence as a governance input (`#132`)

**Files:**

- Modify: `src/process/services/context/ContextRuntimeService.ts`
- Modify: `src/process/services/context/contextDomain.ts`
- Modify: `src/process/services/context/jobs/SessionCompactionJobHandler.ts`
- Modify: `src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts`
- Modify: `src/process/services/context/jobs/SpaceMemoryDistillationJobHandler.ts`
- Modify: `src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts`
- Modify: `src/process/services/context/jobs/SpaceCuratorDistillationFormatter.ts`
- Modify: `tests/unit/context-engine/contextRuntimeService.test.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Create or modify focused job tests under `tests/unit/process/services/context/jobs/`

- [ ] **Step 1: Write failing tests for usage evidence capture and downstream use**

Add tests for:

```ts
- used context evidence
- used skills evidence
- used hooks / commands / schedules evidence
- promotion / review / retention decisions consuming usage evidence
```

- [ ] **Step 2: Run focused tests to verify evidence is not yet integrated**

Run:

```bash
bun run test -- tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/process/services/context/jobs/projectCuratorProposalFormatter.test.ts tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts
```

Expected: FAIL on missing evidence fields or downstream usage.

- [ ] **Step 3: Implement evidence flow without creating a parallel telemetry subsystem**

Implementation requirements:

```ts
- usage evidence is a governance input class
- evidence covers context + capability surfaces
- evidence feeds current steward/curator jobs
- no standalone telemetry runtime is introduced
```

- [ ] **Step 4: Re-run focused verification**

Run:

```bash
bun run test -- tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/process/services/context/jobs/projectCuratorProposalFormatter.test.ts tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/process/services/context/ContextRuntimeService.ts \
  src/process/services/context/contextDomain.ts \
  src/process/services/context/jobs/SessionCompactionJobHandler.ts \
  src/process/services/context/jobs/ProjectCapabilityCurationJobHandler.ts \
  src/process/services/context/jobs/SpaceMemoryDistillationJobHandler.ts \
  src/process/services/context/jobs/ProjectCuratorProposalFormatter.ts \
  src/process/services/context/jobs/SpaceCuratorDistillationFormatter.ts \
  tests/unit/context-engine/contextRuntimeService.test.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/process/services/context/jobs/projectCuratorProposalFormatter.test.ts \
  tests/unit/process/services/context/jobs/spaceCuratorDistillationFormatter.test.ts
git commit -m "feat(context): add governance usage evidence"
```

### Task 4: Strengthen connector provenance and incremental ingestion in the current Space Curator path (`#127`)

**Files:**

- Modify: `src/process/services/context/jobs/ConnectorDigestJobHandler.ts`
- Modify: `src/process/services/context/events/ContextTriggerRouter.ts`
- Modify: `src/process/services/context/contextDomain.ts`
- Modify: `src/process/services/space/SpaceVaultContextSyncService.ts`
- Modify: `src/process/bridge/services/ActivitySnapshotBuilder.ts`
- Modify: `tests/unit/context-engine/contextEngineEventFlow.test.ts`
- Modify: `tests/unit/extensionsBridge.test.ts`
- Modify any connector/job formatter tests affected

- [ ] **Step 1: Write failing tests for provenance, replay, and incremental connector semantics**

Add tests for:

```ts
- stronger source provenance shape
- incremental/replay payload handling through connector triggers
- connector digest output influencing current curator artifacts/state
- renderer projection receiving provenance-rich digest summaries
```

- [ ] **Step 2: Run focused connector tests to confirm missing semantics**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/extensionsBridge.test.ts
```

Expected: FAIL on missing provenance or incremental-ingestion assertions.

- [ ] **Step 3: Implement connector provenance strictly inside the existing Space Curator path**

Implementation requirements:

```ts
- no separate connector context engine
- extend current connector_digest job semantics
- formalize provenance and incremental-ingestion behavior
- keep connector ingestion anchored to Space Curator and existing triggers
```

- [ ] **Step 4: Re-run focused verification**

Run:

```bash
bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/extensionsBridge.test.ts
bunx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/process/services/context/jobs/ConnectorDigestJobHandler.ts \
  src/process/services/context/events/ContextTriggerRouter.ts \
  src/process/services/context/contextDomain.ts \
  src/process/services/space/SpaceVaultContextSyncService.ts \
  src/process/bridge/services/ActivitySnapshotBuilder.ts \
  tests/unit/context-engine/contextEngineEventFlow.test.ts \
  tests/unit/extensionsBridge.test.ts
git commit -m "feat(context): formalize connector provenance"
```

### Task 5: Close the product/runtime loop in the renderer and finalize issue closure packaging

**Files:**

- Modify: `src/common/adapter/ipcBridge.ts`
- Modify: `src/process/bridge/services/ActivitySnapshotBuilder.ts`
- Modify: `src/process/services/context/events/handlers/ContextJobRunProjector.ts`
- Modify: `src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/AgentSettingsPage.module.css`
- Modify: `tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx`
- Modify any related renderer harness or i18n files required

- [ ] **Step 1: Write failing DOM tests for the new evidence/provenance/contract visibility**

Add tests for:

```tsx
- three-governance-identity visibility remains intact
- compaction provenance appears in run detail/log stream
- usage evidence is surfaced without creating a second UI model
- connector provenance is visible in the same observability surface
```

- [ ] **Step 2: Run focused renderer tests to verify the UI closure is still incomplete**

Run:

```bash
bun run test -- tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx
```

Expected: FAIL on the new runtime/evidence/provenance expectations.

- [ ] **Step 3: Implement the minimum renderer closure needed to honestly close the five issues**

Implementation requirements:

```tsx
- keep the UI additive
- show the current three-identity, dual-loop model
- surface provenance/evidence/contract results through current settings observability surfaces
- do not create a second product-level context management surface
```

- [ ] **Step 4: Run full verification**

Run:

```bash
bunx tsc --noEmit
bun run test -- tests/unit/context-engine/contextEngineEventFlow.test.ts tests/unit/context-engine/contextRuntimeService.test.ts tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx tests/unit/extensionsBridge.test.ts
bun run test
```

Expected: PASS.

- [ ] **Step 5: Update GitHub issues and PR packaging**

Issue actions:

```md
- close `#125`
- close `#127`
- close `#132`
- close `#134`
- close `#137`
- leave closing comments summarizing what landed in this branch/PR
```

PR actions:

```md
- summarize the four internal batches in one PR body
- cite the five issues as closed by the PR
- include verification evidence from the commands above
```

- [ ] **Step 6: Commit**

```bash
git add src/common/adapter/ipcBridge.ts \
  src/process/bridge/services/ActivitySnapshotBuilder.ts \
  src/process/services/context/events/handlers/ContextJobRunProjector.ts \
  src/renderer/pages/settings/AgentSettings/SystemRunsPage.tsx \
  src/renderer/pages/settings/AgentSettings/AgentSettingsPage.module.css \
  tests/unit/renderer/settings/SystemRunsPage.dom.test.tsx
git commit -m "feat(context): close phase2 governance runtime loop"
```
