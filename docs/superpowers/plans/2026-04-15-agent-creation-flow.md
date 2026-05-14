# Agent Creation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid Agent creation flow with a five-step status flow, package-backed capability recommendations, and a completion state that supports both starting chat and continuing orchestration.

**Architecture:** Keep the existing `/agents/new` route and `Agent Workspace` shell, but replace the plain create form with a dedicated step flow. Introduce a small recommendation layer that maps user work intent to a bundled package hint, store that hint on custom assistants, and let the existing detail workspace reuse it to show package-backed docs, commands, schedules, and `AGENTS.md`.

**Tech Stack:** React 19, React Router, Arco Design, i18next JSON locale modules, Vitest 4, existing assistant/package registry utilities.

---

### Task 1: Package Hint Model And Recommendation Utilities

**Files:**

- Create: `src/renderer/pages/settings/AgentSettings/Workspace/create/createFlow.ts`
- Modify: `src/common/types/acpTypes.ts`
- Modify: `src/renderer/pages/settings/AgentSettings/Workspace/types.ts`
- Modify: `src/renderer/pages/settings/AgentSettings/Workspace/viewModel.ts`
- Test: `tests/unit/renderer/agentCreateFlow.test.ts`

- [ ] **Step 1: Write the failing recommendation tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  buildCapabilityRecommendation,
  buildCreateFlowSummary,
  type AgentCreateIntentDraft,
} from '@/renderer/pages/settings/AgentSettings/Workspace/create/createFlow';

describe('buildCapabilityRecommendation', () => {
  it('should recommend pm workbench for product planning intent', () => {
    const draft: AgentCreateIntentDraft = {
      workDescription: 'Turn discovery notes into a PRD and roadmap',
      audience: 'Product team',
      output: 'PRD',
      workStyle: 'analyze',
      recurrence: 'frequent',
    };

    const recommendation = buildCapabilityRecommendation(draft);

    expect(recommendation.linkedPackagePresetId).toBe('builtin-pm-workbench');
    expect(recommendation.defaultSkills.length).toBeGreaterThan(0);
    expect(recommendation.commandCount).toBeGreaterThan(0);
  });

  it('should recommend finance analyst for finance review intent', () => {
    const draft: AgentCreateIntentDraft = {
      workDescription: 'Analyze budget variance and financial statements',
      audience: 'Finance',
      output: 'Executive summary',
      workStyle: 'analyze',
      recurrence: 'frequent',
    };

    const recommendation = buildCapabilityRecommendation(draft);

    expect(recommendation.linkedPackagePresetId).toBe('builtin-finance-analyst');
    expect(recommendation.scheduleCount).toBeGreaterThanOrEqual(0);
  });
});

describe('buildCreateFlowSummary', () => {
  it('should summarize the selected capability stack for review step', () => {
    const summary = buildCreateFlowSummary({
      recommendation: {
        linkedPackagePresetId: 'builtin-pm-workbench',
        packageLabel: 'PM Workbench',
        packageDescription: 'Product management assistant',
        defaultSkills: ['pm-discovery', 'pm-prd'],
        defaultHooks: ['quality-gate'],
        commandCount: 4,
        scheduleCount: 1,
        docsCount: 2,
        agentsDocumentAvailable: true,
        runtime: 'codex',
        reasons: ['Matches roadmap and PRD work'],
      },
      editName: 'Roadmap Pilot',
      editDescription: 'Runs PM discovery and planning loops',
      workDescription: 'Draft roadmap and PRD',
      workStyle: 'analyze',
      recurrence: 'frequent',
    });

    expect(summary.capabilityCountLabel).toContain('2');
    expect(summary.automationLabel).toContain('1');
    expect(summary.runtimeLabel).toBe('codex');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/renderer/agentCreateFlow.test.ts`
Expected: FAIL because `createFlow.ts` does not exist and the exported helpers are missing.

- [ ] **Step 3: Implement the minimal recommendation and package-hint model**

```ts
export type AgentCreateIntentDraft = {
  workDescription: string;
  audience: string;
  output: string;
  workStyle: 'analyze' | 'create' | 'execute' | 'maintain';
  recurrence: 'one-off' | 'frequent' | 'continuous';
};

export type AgentCapabilityRecommendation = {
  linkedPackagePresetId: string | null;
  packageLabel: string;
  packageDescription: string;
  defaultSkills: string[];
  defaultHooks: string[];
  commandCount: number;
  scheduleCount: number;
  docsCount: number;
  agentsDocumentAvailable: boolean;
  runtime: string;
  reasons: string[];
};
```

Implement keyword-based recommendation using existing bundled package registry and workspace automation profile definitions. Add `linkedPackagePresetId?: string` to `AcpBackendConfig`, carry it into `AssistantWorkspaceModel`, and use it in `buildAssistantWorkspaceModel()` when resolving package-backed tabs for custom assistants.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/renderer/agentCreateFlow.test.ts`
Expected: PASS with the new recommendation helper and package-hint resolution in place.

- [ ] **Step 5: Commit**

```bash
git add src/common/types/acpTypes.ts src/renderer/pages/settings/AgentSettings/Workspace/types.ts src/renderer/pages/settings/AgentSettings/Workspace/viewModel.ts src/renderer/pages/settings/AgentSettings/Workspace/create/createFlow.ts tests/unit/renderer/agentCreateFlow.test.ts
git commit -m "feat(agent): add create-flow package recommendations"
```

### Task 2: Replace The Create Form With The Five-Step Flow

**Files:**

- Modify: `src/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreatePage.tsx`
- Create: `src/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreateStatusFlow.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/Workspace/AssistantWorkspace.module.css`
- Modify: `src/renderer/services/i18n/locales/en-US/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-CN/settings.json`
- Modify: `src/renderer/services/i18n/locales/zh-TW/settings.json`
- Modify: `src/renderer/services/i18n/locales/ja-JP/settings.json`
- Modify: `src/renderer/services/i18n/locales/ko-KR/settings.json`
- Modify: `src/renderer/services/i18n/locales/tr-TR/settings.json`
- Modify: `src/renderer/services/i18n/i18n-keys.d.ts`
- Test: `tests/unit/renderer/AgentCreatePage.dom.test.tsx`

- [ ] **Step 1: Write the failing DOM test for step flow**

```tsx
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AgentCreatePage from '@/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreatePage';

describe('AgentCreatePage', () => {
  it('should render the status flow and progress from work definition to capability stack', async () => {
    render(
      <MemoryRouter>
        <AgentCreatePage
          activeAssistant={null}
          isReadonlyAssistant={false}
          availableBackends={new Set(['codex', 'gemini'])}
          extensionAcpAdapters={[]}
          editor={buildEditorStub()}
          onInitializeCreate={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Define Work')).toBeInTheDocument();
    expect(screen.getByText('Build Capability Stack')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('What work should this Agent take responsibility for?'), {
      target: { value: 'Turn discovery notes into a PRD and roadmap' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Identity & Rules')).toBeInTheDocument();
    expect(screen.getByText('Core Skills')).toBeInTheDocument();
    expect(screen.getByText('Automation')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/renderer/AgentCreatePage.dom.test.tsx`
Expected: FAIL because the current create page still renders the old single-screen basics panel without the step flow.

- [ ] **Step 3: Implement the hybrid create flow UI**

Replace the old direct `AgentBasicsPanel` create usage with:

- a persistent five-step status flow
- `Define Work` inputs
- `Build Capability Stack` cards and pro expansion
- `Runtime & Automation` step that syncs recommended runtime/hooks/skills into editor state
- `Review` step
- sticky footer navigation between steps

Use i18n keys for every visible string and add the new keys to every supported locale. Regenerate `i18n-keys.d.ts` via `bun run i18n:types`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/renderer/AgentCreatePage.dom.test.tsx`
Expected: PASS with the new status flow and capability step visible.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreatePage.tsx src/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreateStatusFlow.tsx src/renderer/pages/settings/AgentSettings/Workspace/AssistantWorkspace.module.css src/renderer/services/i18n/locales/en-US/settings.json src/renderer/services/i18n/locales/zh-CN/settings.json src/renderer/services/i18n/locales/zh-TW/settings.json src/renderer/services/i18n/locales/ja-JP/settings.json src/renderer/services/i18n/locales/ko-KR/settings.json src/renderer/services/i18n/locales/tr-TR/settings.json src/renderer/services/i18n/i18n-keys.d.ts tests/unit/renderer/AgentCreatePage.dom.test.tsx
git commit -m "feat(agent): add staged agent creation flow"
```

### Task 3: Persist Recommendations And Add Completion Actions

**Files:**

- Modify: `src/renderer/hooks/assistant/useAssistantEditor.ts`
- Modify: `src/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreatePage.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/Workspace/detail/AgentDetailPage.tsx`
- Modify: `src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/useBundledAgentPackageContent.ts`
- Modify: `src/renderer/pages/conversation/utils/createConversationParams.ts`
- Test: `tests/unit/renderer/AgentCreatePage.dom.test.tsx`

- [ ] **Step 1: Write the failing completion-flow test**

```tsx
it('should create the assistant, show the done step, and support start chat and continue orchestration', async () => {
  const handleSave = vi.fn().mockResolvedValue('custom-123');

  renderCreatePage({ handleSave });

  fillRequiredWorkAndReviewInputs();
  fireEvent.click(screen.getByRole('button', { name: 'Create and Continue Orchestration' }));

  expect(await screen.findByText('Done')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start Chat' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue Orchestration' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/unit/renderer/AgentCreatePage.dom.test.tsx`
Expected: FAIL because save still navigates directly to `/agents/:assistantId/skills` and no completion state exists.

- [ ] **Step 3: Implement save persistence and done-step actions**

Update `useAssistantEditor.handleSave()` to persist `linkedPackagePresetId` for newly created and updated custom assistants. In `AgentCreatePage`, keep the user inside the flow after save, render the `Done` step, and wire:

- `Start Chat`
  - create a conversation for the newly created assistant and navigate to `/conversation/:id`
- `Continue Orchestration`
  - navigate to `/agents/:assistantId/:defaultTab`

Ensure package-backed content loaders resolve through the linked package hint so custom assistants can surface package docs and `AGENTS.md` after creation.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/unit/renderer/AgentCreatePage.dom.test.tsx`
Expected: PASS with post-create completion actions working and the custom assistant retaining package-backed detail surfaces.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/hooks/assistant/useAssistantEditor.ts src/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreatePage.tsx src/renderer/pages/settings/AgentSettings/Workspace/detail/AgentDetailPage.tsx src/renderer/pages/settings/AgentSettings/Workspace/detail/tabs/useBundledAgentPackageContent.ts src/renderer/pages/conversation/utils/createConversationParams.ts tests/unit/renderer/AgentCreatePage.dom.test.tsx
git commit -m "feat(agent): add agent creation completion flow"
```

### Task 4: Verification, Issue Update, And PR Prep

**Files:**

- Modify: `docs/superpowers/specs/2026-04-15-agent-creation-flow-design.md` (only if implementation-driven clarifications are needed)

- [ ] **Step 1: Run focused tests**

Run: `bunx vitest run tests/unit/renderer/agentCreateFlow.test.ts tests/unit/renderer/AgentCreatePage.dom.test.tsx`
Expected: PASS for both new test files.

- [ ] **Step 2: Run i18n validation**

Run: `bun run i18n:types && node scripts/check-i18n.js`
Expected: `i18n-keys.d.ts` regenerated and no locale completeness errors.

- [ ] **Step 3: Run typecheck, lint, format, and full tests**

Run: `bunx tsc --noEmit && bun run lint:fix && bun run format && bun run test`
Expected: exit code 0 for typecheck, formatting/linting clean, and full test suite passing.

- [ ] **Step 4: Update issue metadata and post an implementation comment**

Run:

```bash
gh issue edit 154 --add-label enhancement --repo contextgo/contextgo
gh issue comment 154 --repo contextgo/contextgo --body "Implemented the first landing slice for the hybrid Agent creation flow in a dedicated worktree. This includes the staged status flow, package-backed capability recommendations, linked package metadata for custom assistants, and a post-create completion state with Start Chat / Continue Orchestration."
```

Expected: issue labels updated and progress comment posted successfully.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(agent): finalize agent creation flow verification"
```
