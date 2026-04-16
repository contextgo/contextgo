# Context Engine Issue Realignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Realign the Context Engine epic follow-up issues on GitHub with the architecture already merged on `main`, so the tracker uses the current three-identity, dual-loop, agent-package-based runtime model.

**Architecture:** Use the merged codebase and the approved realignment spec as the source of truth, then edit the affected GitHub issues in place. Keep issue continuity where possible, close only the one issue whose framing most directly conflicts with the current session artifact model, and add cross-links plus migration comments so future work extends the winning implementation rather than inventing a parallel subsystem.

**Tech Stack:** GitHub CLI, Markdown issue bodies, repository-local spec documents

---

### Task 1: Prepare the rewritten issue payloads

**Files:**

- Modify: `docs/superpowers/specs/2026-04-17-context-engine-issue-realignment-design.md`
- Create: `docs/superpowers/plans/2026-04-17-context-engine-issue-realignment-plan.md`

- [ ] **Step 1: Draft the final action map for the target issues**

```md
- `#134`: keep, rewrite heavily
- `#137`: keep, rewrite and narrow
- `#125`: keep, rewrite and constrain
- `#132`: keep, moderate rewrite
- `#127`: keep, rewrite into `Space Curator` / `connector_digest` model
- `#135`: close with migration comment
```

- [ ] **Step 2: Confirm the rewritten issues use the current implementation vocabulary**

Each rewritten issue must explicitly align with:

```md
- `Session Steward`
- `Project Curator`
- `Space Curator`
- dual-loop runtime model
- `hook / lifecycle / timer / manual / connector / derived`
- agent package / skills / hooks / commands / schedules capability surface
```

- [ ] **Step 3: Commit the execution plan**

```bash
git add \
  docs/superpowers/specs/2026-04-17-context-engine-issue-realignment-design.md \
  docs/superpowers/plans/2026-04-17-context-engine-issue-realignment-plan.md
git commit -m "docs(context): add issue realignment plan"
```

### Task 2: Rewrite the five keep-in-place issues on GitHub

**Files:**

- Modify remotely: GitHub issues `#125`, `#127`, `#132`, `#134`, `#137`

- [ ] **Step 1: Rewrite `#134` around the existing lifecycle contract**

Run:

```bash
gh issue edit 134 \
  --title "[Feature]: [P1] 补全现有 Context Engine 生命周期 Hook Contract，收敛 Turn / Session / Compression / Delegation 接口" \
  --body-file /tmp/context-issue-134.md
```

Expected body themes:

```md
- current lifecycle trigger/router/runtime contract already exists on `main`
- follow-up work should extend the current contract rather than invent a second one
- ownership remains inside the existing governance runtime path
```

- [ ] **Step 2: Rewrite `#137` around the existing Session Steward compaction path**

Run:

```bash
gh issue edit 137 \
  --title "[Feature]: [P1] 将现有 Session Steward compaction 路径正式化为稳定的 Context Compression 协议" \
  --body-file /tmp/context-issue-137.md
```

Expected body themes:

```md
- `session_compaction` is already live
- focus on invariants, budgets, provenance, and handoff protocol
- treat this as formalization of the existing path, not a greenfield subsystem
```

- [ ] **Step 3: Rewrite `#125`, `#132`, and `#127` against the merged architecture**

Run:

```bash
gh issue edit 125 --title "[Feature]: [P1] 在现有治理 jobs 下正式化 Memory Extraction 与 Profile Operations Runtime" --body-file /tmp/context-issue-125.md
gh issue edit 132 --title "[Feature]: [P1] 将 usage evidence 纳入现有 session-to-memory 治理闭环" --body-file /tmp/context-issue-132.md
gh issue edit 127 --title "[Feature]: [P2] 通过现有 Space Curator / connector_digest 路径正式化 connector provenance 与增量 ingestion" --body-file /tmp/context-issue-127.md
```

Expected body themes:

```md
- `#125`: extraction/profile ops must live under current governance jobs and state transitions
- `#132`: usage evidence is an input to current governance, not a new telemetry subsystem
- `#127`: connector ingestion extends current `Space Curator` / `connector_digest` flow
```

- [ ] **Step 4: Add migration comments to each rewritten issue**

Run pattern:

```bash
gh issue comment <number> --body "Issue wording updated to match the architecture now merged on `main`: three stable governance identities, a dual-loop runtime, and the current trigger/job/artifact model. Future work on this issue should extend the current implementation rather than introduce a parallel subsystem."
```

- [ ] **Step 5: Commit the local plan-tracking change only**

```bash
git add docs/superpowers/plans/2026-04-17-context-engine-issue-realignment-plan.md
git commit -m "docs(context): checkpoint issue realignment execution"
```

### Task 3: Close the conflicting recall issue and add cross-links

**Files:**

- Modify remotely: GitHub issue `#135`
- Modify remotely: GitHub issues `#125`, `#127`, `#132`, `#134`, `#137`

- [ ] **Step 1: Close `#135` with a migration comment**

Run:

```bash
gh issue comment 135 --body "Closing this issue because its current framing proposes a parallel session-recall/archive subsystem that conflicts with the session artifact model already merged on `main` (`timeline`, `working context`, `checkpoints`). The underlying concern remains valid, but follow-up work should now extend the existing session/runtime/assembly path rather than introduce a competing subsystem."
gh issue close 135
```

- [ ] **Step 2: Add explicit cross-links among the retained issues**

Run pattern:

```bash
gh issue comment 134 --body "Related follow-up issues in the same runtime architecture: #137 (compaction formalization), #125 (extraction/profile ops), #132 (usage evidence), #127 (connector-first ingestion)."
gh issue comment 137 --body "Related follow-up issues in the same runtime architecture: #134 (lifecycle contract), #125 (extraction/profile ops), #132 (usage evidence), #127 (connector-first ingestion)."
gh issue comment 125 --body "Related follow-up issues in the same runtime architecture: #134 (lifecycle contract), #137 (compaction formalization), #132 (usage evidence), #127 (connector-first ingestion)."
gh issue comment 132 --body "Related follow-up issues in the same runtime architecture: #134 (lifecycle contract), #137 (compaction formalization), #125 (extraction/profile ops), #127 (connector-first ingestion)."
gh issue comment 127 --body "Related follow-up issues in the same runtime architecture: #134 (lifecycle contract), #137 (compaction formalization), #125 (extraction/profile ops), #132 (usage evidence)."
```

- [ ] **Step 3: Verify the issue tracker state**

Run:

```bash
gh issue view 125 --json title,state,url
gh issue view 127 --json title,state,url
gh issue view 132 --json title,state,url
gh issue view 134 --json title,state,url
gh issue view 137 --json title,state,url
gh issue view 135 --json title,state,url
```

Expected:

```md
- `#125/#127/#132/#134/#137` remain open with rewritten titles
- `#135` is closed
```

- [ ] **Step 4: Commit the local plan-tracking change**

```bash
git add docs/superpowers/plans/2026-04-17-context-engine-issue-realignment-plan.md
git commit -m "docs(context): complete issue realignment execution"
```
