# Workbench Host Phase 3A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shell explicitly consume `WorkbenchShellContract` so titlebar and toolbar slots are defined by the current workbench contract instead of by hardcoded conversation-only assumptions.

**Architecture:** Upgrade `WorkbenchShellContract` to describe titlebar and toolbar slot objects, add a shared slot-resolution helper under `src/renderer/pages/WorkbenchHost/`, and make both `Titlebar` and `ChatLayout` read slot ids from the active workbench definition. Keep current `/conversation/:id` UI behavior unchanged so phase 3A remains a shell/workbench boundary change only.

**Tech Stack:** React, React Router, TypeScript, Vitest

---

### Task 1: Add Failing Shell-Contract Tests

**Files:**

- Modify: `tests/unit/renderer/Titlebar.dom.test.tsx`
- Modify: `tests/unit/renderer/layout/ChatLayout.dom.test.tsx`

- [ ] **Step 1: Add a titlebar regression that expects contract-driven slot containers**

Extend `tests/unit/renderer/Titlebar.dom.test.tsx` so the desktop conversation case asserts both slot containers by id:

```tsx
it('renders shell slots defined by the active conversation workbench contract', async () => {
  const { container } = renderTitlebar('/conversation/conv-1', {
    workspaceAvailable: true,
    openTabs: [createTab('conv-1')],
  });

  expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  expect(container.querySelector('#app-titlebar-chat-slot')).toBeTruthy();
  expect(container.querySelector('#app-titlebar-toolbar-slot')).toBeTruthy();
});
```

Then add a non-conversation assertion that the shell stays contract-empty:

```tsx
it('does not render workbench slots when the active route has no shell contract', async () => {
  const { container } = renderTitlebar('/guid');

  expect(await screen.findByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  expect(container.querySelector('#app-titlebar-chat-slot')).toBeNull();
  expect(container.querySelector('#app-titlebar-toolbar-slot')).toBeNull();
});
```

- [ ] **Step 2: Add a chat-layout regression that expects slot ids to come from the workbench helper**

Update `tests/unit/renderer/layout/ChatLayout.dom.test.tsx` to provide shell slot containers before rendering and assert that the portals land there:

```tsx
beforeEach(() => {
  document.body.innerHTML = `
    <div id="app-titlebar-chat-slot"></div>
    <div id="app-titlebar-toolbar-slot"></div>
  `;
  // existing mocks...
});

it('mounts desktop header and toolbar content into workbench-defined shell slots', () => {
  useLayoutContextMock.mockReturnValue({
    isMobile: false,
    siderCollapsed: false,
    setSiderCollapsed: vi.fn(),
  });

  render(
    <ChatLayout
      title='Conversation 1'
      sider={<div>workspace</div>}
      headerLeft={<div>model-pill</div>}
      headerExtra={<div>toolbar-extra</div>}
      workspaceEnabled={true}
      conversationId='conv-1'
    >
      <div>chat-body</div>
    </ChatLayout>
  );

  expect(document.getElementById('app-titlebar-chat-slot')).toHaveTextContent('model-pill');
  expect(document.getElementById('app-titlebar-toolbar-slot')).toHaveTextContent('toolbar-extra');
});
```

- [ ] **Step 3: Run the targeted shell-contract tests to verify RED**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/Titlebar.dom.test.tsx \
  tests/unit/renderer/layout/ChatLayout.dom.test.tsx
```

Expected: FAIL because shell slot rendering is still driven by old conversation heuristics and `ChatLayout` still hardcodes slot ids directly instead of using a shared workbench slot helper.

### Task 2: Implement Shell Slot Contracts And Shared Resolution

**Files:**

- Modify: `src/renderer/pages/WorkbenchHost/types.ts`
- Modify: `src/renderer/pages/WorkbenchHost/definitions.ts`
- Create: `src/renderer/pages/WorkbenchHost/slots.ts`
- Modify: `src/renderer/components/layout/Titlebar/index.tsx`
- Modify: `src/renderer/pages/conversation/components/ChatLayout/index.tsx`

- [ ] **Step 1: Upgrade `WorkbenchShellContract` to express slot objects**

Update `src/renderer/pages/WorkbenchHost/types.ts`:

```ts
export type WorkbenchShellTitlebarContract = {
  primarySlotId: 'app-titlebar-chat-slot';
};

export type WorkbenchShellToolbarContract = {
  slotId: 'app-titlebar-toolbar-slot';
};

export type WorkbenchShellContract = {
  shellStyle: 'conversation';
  titlebar?: WorkbenchShellTitlebarContract;
  toolbar?: WorkbenchShellToolbarContract;
};
```

- [ ] **Step 2: Move the conversation slot ids into the built-in workbench definition**

Update `src/renderer/pages/WorkbenchHost/definitions.ts`:

```ts
export const conversationCoworkWorkbench: WorkbenchDefinition = {
  kind: 'conversation-cowork',
  capabilities: ['chat', 'preview', 'workspace', 'browser'],
  shellContract: {
    shellStyle: 'conversation',
    titlebar: {
      primarySlotId: 'app-titlebar-chat-slot',
    },
    toolbar: {
      slotId: 'app-titlebar-toolbar-slot',
    },
  },
};
```

- [ ] **Step 3: Add a shared slot-resolution helper**

Create `src/renderer/pages/WorkbenchHost/slots.ts`:

```ts
import type { WorkbenchDefinition } from './types';

export const getWorkbenchTitlebarPrimarySlotId = (definition: WorkbenchDefinition | null | undefined): string | null => {
  return definition?.shellContract.titlebar?.primarySlotId ?? null;
};

export const getWorkbenchToolbarSlotId = (definition: WorkbenchDefinition | null | undefined): string | null => {
  return definition?.shellContract.toolbar?.slotId ?? null;
};
```

- [ ] **Step 4: Make `Titlebar` read slot ids from the active workbench contract**

Update `src/renderer/components/layout/Titlebar/index.tsx` to read the active workbench definition via `useWorkbenchHostContext()` and derive slot ids through the helper:

```tsx
const workbench = useWorkbenchHostContext();
const titlebarPrimarySlotId = getWorkbenchTitlebarPrimarySlotId(workbench?.definition);
const toolbarSlotId = getWorkbenchToolbarSlotId(workbench?.definition);
const showWorkbenchPrimarySlot = Boolean(titlebarPrimarySlotId);
const showWorkbenchToolbarSlot = Boolean(toolbarSlotId);
```

Then render slots conditionally:

```tsx
{showWorkbenchPrimarySlot ? (
  <div className='app-titlebar__desktop-content app-titlebar__desktop-content--conversation'>
    <div id={titlebarPrimarySlotId!} className='h-full min-w-0' />
    {isDesktopRuntime ? <div className='app-titlebar__drag-spacer' aria-hidden='true' /> : null}
  </div>
) : isDesktopRuntime ? (
  <div className='app-titlebar__drag-spacer' aria-hidden='true' />
) : null}

{showDesktopToolbar && (
  <div className='app-titlebar__toolbar app-titlebar__toolbar--desktop'>
    <div className='app-titlebar__toolbar-actions'>
      {showWorkbenchToolbarSlot ? <div id={toolbarSlotId!} className='app-titlebar__toolbar-slot' /> : null}
```

Keep the existing workspace chip and window controls unchanged.

- [ ] **Step 5: Make `ChatLayout` resolve portal targets through the helper**

Update `src/renderer/pages/conversation/components/ChatLayout/index.tsx` to read the active workbench definition and resolve slot ids before querying the DOM:

```tsx
const workbench = useWorkbenchHostContext();
const titlebarPrimarySlotId = getWorkbenchTitlebarPrimarySlotId(workbench?.definition);
const toolbarSlotId = getWorkbenchToolbarSlotId(workbench?.definition);

useEffect(() => {
  if (isMobile || typeof document === 'undefined') {
    setDesktopHeaderTarget(null);
    setDesktopToolbarTarget(null);
    return;
  }

  setDesktopHeaderTarget(titlebarPrimarySlotId ? document.getElementById(titlebarPrimarySlotId) : null);
  setDesktopToolbarTarget(toolbarSlotId ? document.getElementById(toolbarSlotId) : null);
}, [isMobile, titlebarPrimarySlotId, toolbarSlotId]);
```

Portal logic stays as-is; only the slot lookup changes.

- [ ] **Step 6: Re-run the targeted shell-contract tests to verify GREEN**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/Titlebar.dom.test.tsx \
  tests/unit/renderer/layout/ChatLayout.dom.test.tsx
```

Expected: PASS with shell slots now driven by the active workbench contract and `ChatLayout` portal targets resolved through the shared helper.

- [ ] **Step 7: Commit the shell-contract slice**

```bash
git add \
  src/renderer/pages/WorkbenchHost/types.ts \
  src/renderer/pages/WorkbenchHost/definitions.ts \
  src/renderer/pages/WorkbenchHost/slots.ts \
  src/renderer/components/layout/Titlebar/index.tsx \
  src/renderer/pages/conversation/components/ChatLayout/index.tsx \
  tests/unit/renderer/Titlebar.dom.test.tsx \
  tests/unit/renderer/layout/ChatLayout.dom.test.tsx
git commit -m "refactor(workbench): let shell consume slot contract"
```

### Task 3: Run Regression And Type Verification

**Files:**

- Verify: `tests/unit/renderer/Titlebar.dom.test.tsx`
- Verify: `tests/unit/renderer/layout/ChatLayout.dom.test.tsx`
- Verify: `tests/unit/renderer/layout/Router.dom.test.tsx`
- Verify: `tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx`

- [ ] **Step 1: Run the renderer regression set that guards phase 1-3A behavior**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/Titlebar.dom.test.tsx \
  tests/unit/renderer/layout/ChatLayout.dom.test.tsx \
  tests/unit/renderer/layout/Router.dom.test.tsx \
  tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx
```

Expected: PASS, proving shell contract consumption did not regress the existing host route or titlebar/container behavior.

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
bunx tsc --noEmit --pretty false
```

Expected: Exit code `0`.
