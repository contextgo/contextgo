# Workbench Host Phase 3 Capability Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the `conversation-cowork` capability normalization bundle so `browser`, `workspace`, and `preview` all have clearer, user-visible workbench surface semantics without rewriting the conversation layout.

**Architecture:** Keep `conversation-cowork` on the existing `ChatLayout`, `Workspace`, and `PreviewPanel` structure, but normalize the capability surface in three coordinated slices: browser remains an always-visible header capability chip, workspace gets a lightweight explicit surface state/entry, and preview gets a lightweight explicit surface state/entry. Reuse existing browser asset, workspace, and preview flows rather than introducing new state systems or routes.

**Tech Stack:** React, TypeScript, Vitest, Arco Design

---

### Task 1: Add Failing Capability Surface Tests For Workspace And Preview

**Files:**

- Modify: `tests/unit/renderer/chat/ChatConversation.dom.test.tsx`
- Modify: `tests/unit/renderer/ChatSider.dom.test.tsx`
- Create or Modify: `tests/unit/renderer/preview/PreviewSurface.dom.test.tsx`

- [ ] **Step 1: Add a ChatConversation regression that expects a visible workspace surface indicator**

Extend `tests/unit/renderer/chat/ChatConversation.dom.test.tsx` with a conversation that has `extra.workspace`:

```tsx
it('shows the workspace capability surface state when the conversation has a workspace', () => {
  const conversation = {
    ...createConversation('acp', 'acp-workspace-capability'),
    extra: {
      workspace: '/tmp/capability-workspace',
    },
  } as TChatConversation;

  render(<ChatConversation conversation={conversation} />);

  expect(screen.getByText(/Workspace/i)).toBeInTheDocument();
  expect(screen.getByText(/capability-workspace/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Add a ChatConversation regression that expects a visible preview surface indicator when preview is open**

Still in `tests/unit/renderer/chat/ChatConversation.dom.test.tsx`, make the mocked preview context return an open URL/file preview and assert a visible preview surface indicator:

```tsx
it('shows the preview capability surface state when preview is currently open', () => {
  mockedPreviewContext({
    isOpen: true,
    activeTab: {
      id: 'preview-1',
      title: 'README.md',
      content: '# README',
      contentType: 'markdown',
      metadata: {
        fileName: 'README.md',
      },
    },
  });

  render(<ChatConversation conversation={createConversation('acp', 'acp-preview-capability')} />);

  expect(screen.getByText(/Preview/i)).toBeInTheDocument();
  expect(screen.getByText(/README\.md/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Add a ChatSider regression that expects an explicit workspace empty-state surface**

Extend `tests/unit/renderer/ChatSider.dom.test.tsx` so a conversation without `extra.workspace` shows a workbench-style empty surface instead of an empty `<div>`:

```tsx
it('renders an explicit workspace capability empty state when no workspace is available', () => {
  render(<ChatSider conversation={createConversationWithoutWorkspace()} />);

  expect(screen.getByText(/No workspace linked/i)).toBeInTheDocument();
});
```

- [ ] **Step 4: Add a preview-surface regression for the lightweight capability badge or state row**

Create or extend `tests/unit/renderer/preview/PreviewSurface.dom.test.tsx` with a minimal wrapper around the surface component/helper you plan to add:

```tsx
it('renders the active preview label for the capability surface', () => {
  render(<PreviewSurfaceIndicator label='README.md' isOpen={true} />);

  expect(screen.getByText(/Preview/i)).toBeInTheDocument();
  expect(screen.getByText('README.md')).toBeInTheDocument();
});
```

- [ ] **Step 5: Run the targeted capability bundle tests to verify RED**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/chat/ChatConversation.dom.test.tsx \
  tests/unit/renderer/ChatSider.dom.test.tsx \
  tests/unit/renderer/preview/PreviewSurface.dom.test.tsx
```

Expected: FAIL because workspace and preview still lack explicit workbench surface indicators and `ChatSider` still renders a blank container when no workspace is present.

### Task 2: Implement Workspace And Preview Surface Normalization

**Files:**

- Modify: `src/renderer/pages/conversation/components/ChatConversation.tsx`
- Modify: `src/renderer/pages/conversation/components/ChatSider.tsx`
- Create: `src/renderer/pages/conversation/components/ConversationCapabilitySurface.tsx`
- Create: `src/renderer/pages/conversation/components/getConversationCapabilityState.ts`
- Optionally Modify: `src/renderer/pages/conversation/components/ChatLayout/index.tsx`

- [ ] **Step 1: Add a lightweight capability-state helper for conversation-cowork**

Create `src/renderer/pages/conversation/components/getConversationCapabilityState.ts`:

```ts
import type { TChatConversation } from '@/common/config/storage';
import type { PreviewTab } from '@/renderer/pages/conversation/Preview/context/PreviewContext';

export type ConversationCapabilityState = {
  browser: {
    visible: true;
    label?: string;
  };
  workspace: {
    available: boolean;
    label?: string;
  };
  preview: {
    open: boolean;
    label?: string;
  };
};

export const getConversationCapabilityState = (
  conversation: TChatConversation,
  activePreviewTab: PreviewTab | null
): ConversationCapabilityState => ({
  browser: {
    visible: true,
  },
  workspace: {
    available: Boolean(conversation.extra?.workspace),
    label: conversation.extra?.workspace || undefined,
  },
  preview: {
    open: Boolean(activePreviewTab),
    label: activePreviewTab?.metadata?.fileName || activePreviewTab?.title || undefined,
  },
});
```

- [ ] **Step 2: Add a small reusable capability surface indicator component**

Create `src/renderer/pages/conversation/components/ConversationCapabilitySurface.tsx`:

```tsx
import React from 'react';

type ConversationCapabilitySurfaceProps = {
  title: string;
  value?: string;
  emptyLabel?: string;
};

const ConversationCapabilitySurface: React.FC<ConversationCapabilitySurfaceProps> = ({ title, value, emptyLabel }) => {
  return (
    <div className='app-icon-row gap-6px text-12px text-t-secondary'>
      <span>{title}</span>
      <span className='truncate max-w-180px' title={value || emptyLabel}>
        {value || emptyLabel}
      </span>
    </div>
  );
};

export default ConversationCapabilitySurface;
```

- [ ] **Step 3: Surface workspace and preview state in the conversation header extras**

Update `src/renderer/pages/conversation/components/ChatConversation.tsx` to compute capability state and render the new surfaces alongside existing header entries:

```tsx
const { activeTab: activePreviewTab, openPreview } = usePreviewContext();
const capabilityState = useMemo(
  () => (conversation ? getConversationCapabilityState(conversation, activePreviewTab) : null),
  [conversation, activePreviewTab]
);
```

Then add lightweight indicators in `headerExtraNode`, for example:

```tsx
{
  capabilityState?.workspace ? (
    <ConversationCapabilitySurface
      title='Workspace'
      value={capabilityState.workspace.available ? capabilityState.workspace.label : undefined}
      emptyLabel='No workspace linked'
    />
  ) : null;
}
{
  capabilityState?.preview ? (
    <ConversationCapabilitySurface
      title='Preview'
      value={capabilityState.preview.open ? capabilityState.preview.label : undefined}
      emptyLabel='No active preview'
    />
  ) : null;
}
```

- [ ] **Step 4: Replace the empty ChatSider fallback with an explicit workspace surface empty state**

Update `src/renderer/pages/conversation/components/ChatSider.tsx`:

```tsx
if (!workspaceNode) {
  return <div className='text-12px text-t-secondary px-12px py-12px'>No workspace linked</div>;
}
```

- [ ] **Step 5: Re-run the capability bundle tests to verify GREEN**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/chat/ChatConversation.dom.test.tsx \
  tests/unit/renderer/ChatSider.dom.test.tsx \
  tests/unit/renderer/preview/PreviewSurface.dom.test.tsx
```

Expected: PASS with explicit workspace and preview capability surface states rendered in the conversation workbench.

- [ ] **Step 6: Commit the workspace/preview normalization slice**

```bash
git add \
  src/renderer/pages/conversation/components/ChatConversation.tsx \
  src/renderer/pages/conversation/components/ChatSider.tsx \
  src/renderer/pages/conversation/components/ConversationCapabilitySurface.tsx \
  src/renderer/pages/conversation/components/getConversationCapabilityState.ts \
  tests/unit/renderer/chat/ChatConversation.dom.test.tsx \
  tests/unit/renderer/ChatSider.dom.test.tsx \
  tests/unit/renderer/preview/PreviewSurface.dom.test.tsx
git commit -m "feat(workbench): normalize conversation capability surface"
```

### Task 3: Run Bundle Regression And Type Verification

**Files:**

- Verify: `tests/unit/renderer/chat/ChatConversation.dom.test.tsx`
- Verify: `tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx`
- Verify: `tests/unit/renderer/ChatSider.dom.test.tsx`
- Verify: `tests/unit/renderer/Titlebar.dom.test.tsx`
- Verify: `tests/unit/renderer/layout/ChatLayout.dom.test.tsx`

- [ ] **Step 1: Run the bundle regression set**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/chat/ChatConversation.dom.test.tsx \
  tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx \
  tests/unit/renderer/ChatSider.dom.test.tsx \
  tests/unit/renderer/Titlebar.dom.test.tsx \
  tests/unit/renderer/layout/ChatLayout.dom.test.tsx
```

Expected: PASS, proving browser/workspace/preview capability normalization does not regress the shell/workbench boundary work from phase 3A.

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
bunx tsc --noEmit --pretty false
```

Expected: Exit code `0`.
