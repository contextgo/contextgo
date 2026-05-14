# Workbench Host Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote `WorkbenchHost` from a `workbenchKind` string wrapper into a definition-based host boundary so `conversation-cowork` carries explicit capability and shell contract metadata without changing current shell UI behavior.

**Architecture:** Add a typed `WorkbenchDefinition` model under `src/renderer/pages/WorkbenchHost/`, centralize the built-in `conversation-cowork` definition, and make both `Router` and `WorkbenchHostContext` use that definition as the source of truth. Keep `Titlebar`, `Layout`, and `ChatLayout` behavior unchanged so phase 2 stays at the declaration layer only.

**Tech Stack:** React, React Router, TypeScript, Vitest

---

### Task 1: Write Failing Tests For The Definition Model

**Files:**

- Create: `tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx`
- Modify: `tests/unit/renderer/layout/Router.dom.test.tsx`

- [ ] **Step 1: Add a host-context test that expects `WorkbenchHost` to expose a full definition**

Create `tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx` with a minimal consumer component:

```tsx
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import WorkbenchHost from '@/renderer/pages/WorkbenchHost';
import { conversationCoworkWorkbench } from '@/renderer/pages/WorkbenchHost/definitions';
import { useWorkbenchHostContext } from '@/renderer/pages/WorkbenchHost/context';

const WorkbenchProbe: React.FC = () => {
  const context = useWorkbenchHostContext();

  return (
    <>
      <div data-testid='workbench-kind'>{context?.definition.kind}</div>
      <div data-testid='workbench-capabilities'>{context?.definition.capabilities.join(',')}</div>
      <div data-testid='workbench-shell-style'>{context?.definition.shellContract.shellStyle}</div>
    </>
  );
};

describe('WorkbenchHost', () => {
  it('provides the full workbench definition through context', () => {
    render(
      <WorkbenchHost definition={conversationCoworkWorkbench}>
        <WorkbenchProbe />
      </WorkbenchHost>
    );

    expect(screen.getByTestId('workbench-kind')).toHaveTextContent('conversation-cowork');
    expect(screen.getByTestId('workbench-capabilities')).toHaveTextContent('chat,preview,workspace,browser');
    expect(screen.getByTestId('workbench-shell-style')).toHaveTextContent('conversation');
  });
});
```

- [ ] **Step 2: Extend the router test to expect a definition object instead of a bare `workbenchKind`**

Update `tests/unit/renderer/layout/Router.dom.test.tsx` so the mocked `WorkbenchHost` records a definition:

```tsx
vi.mock('@renderer/pages/WorkbenchHost', () => ({
  default: ({
    definition,
    children,
  }: {
    definition: {
      kind: string;
      capabilities: string[];
      shellContract: {
        shellStyle: string;
        titlebarSlot: string;
        toolbarSlot: string;
      };
    };
    children?: React.ReactNode;
  }) => {
    workbenchHostPropsSpy({ definition });
    return (
      <div data-testid='workbench-host' data-workbench-kind={definition.kind}>
        {children}
      </div>
    );
  },
}));
```

Then update the assertion:

```tsx
expect(workbenchHostPropsSpy).toHaveBeenCalledWith({
  definition: {
    kind: 'conversation-cowork',
    capabilities: ['chat', 'preview', 'workspace', 'browser'],
    shellContract: {
      shellStyle: 'conversation',
      titlebarSlot: 'conversation-primary',
      toolbarSlot: 'conversation-toolbar',
    },
  },
});
```

- [ ] **Step 3: Run the targeted tests to verify they fail for the right reason**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx \
  tests/unit/renderer/layout/Router.dom.test.tsx
```

Expected: FAIL because `definitions.ts` / `types.ts` do not exist yet and `WorkbenchHost` still accepts `workbenchKind` instead of `definition`.

### Task 2: Add The Definition Types, Built-In Definition, And Router/Host Wiring

**Files:**

- Create: `src/renderer/pages/WorkbenchHost/types.ts`
- Create: `src/renderer/pages/WorkbenchHost/definitions.ts`
- Modify: `src/renderer/pages/WorkbenchHost/context.ts`
- Modify: `src/renderer/pages/WorkbenchHost/index.tsx`
- Modify: `src/renderer/components/layout/Router.tsx`

- [ ] **Step 1: Add the shared workbench types**

Create `src/renderer/pages/WorkbenchHost/types.ts`:

```ts
export type WorkbenchKind = 'conversation-cowork';

export type WorkbenchCapability = 'chat' | 'preview' | 'workspace' | 'browser';

export type WorkbenchShellContract = {
  shellStyle: 'conversation';
  titlebarSlot: 'conversation-primary';
  toolbarSlot: 'conversation-toolbar';
};

export type WorkbenchDefinition = {
  kind: WorkbenchKind;
  capabilities: WorkbenchCapability[];
  shellContract: WorkbenchShellContract;
};
```

- [ ] **Step 2: Add the built-in `conversation-cowork` definition**

Create `src/renderer/pages/WorkbenchHost/definitions.ts`:

```ts
import type { WorkbenchDefinition } from './types';

export const conversationCoworkWorkbench: WorkbenchDefinition = {
  kind: 'conversation-cowork',
  capabilities: ['chat', 'preview', 'workspace', 'browser'],
  shellContract: {
    shellStyle: 'conversation',
    titlebarSlot: 'conversation-primary',
    toolbarSlot: 'conversation-toolbar',
  },
};
```

- [ ] **Step 3: Upgrade the host context to carry the full definition**

Update `src/renderer/pages/WorkbenchHost/context.ts`:

```ts
import React from 'react';
import type { WorkbenchDefinition, WorkbenchKind } from './types';

export type WorkbenchHostContextValue = {
  definition: WorkbenchDefinition;
  workbenchKind: WorkbenchKind;
};

export const WorkbenchHostContext = React.createContext<WorkbenchHostContextValue | null>(null);

export const useWorkbenchHostContext = (): WorkbenchHostContextValue | null => {
  return React.useContext(WorkbenchHostContext);
};
```

- [ ] **Step 4: Upgrade `WorkbenchHost` to accept a definition**

Update `src/renderer/pages/WorkbenchHost/index.tsx`:

```tsx
import React from 'react';
import { WorkbenchHostContext } from './context';
import type { WorkbenchDefinition } from './types';

type WorkbenchHostProps = {
  definition: WorkbenchDefinition;
  children: React.ReactNode;
};

const WorkbenchHost: React.FC<WorkbenchHostProps> = ({ definition, children }) => {
  return (
    <WorkbenchHostContext.Provider
      value={{
        definition,
        workbenchKind: definition.kind,
      }}
    >
      <div className='workbench-host size-full min-h-0' data-workbench-kind={definition.kind}>
        {children}
      </div>
    </WorkbenchHostContext.Provider>
  );
};
```

- [ ] **Step 5: Route the conversation page through the built-in definition**

Update the workbench route helper in `src/renderer/components/layout/Router.tsx`:

```tsx
import { conversationCoworkWorkbench } from '@renderer/pages/WorkbenchHost/definitions';
import type { WorkbenchDefinition } from '@renderer/pages/WorkbenchHost/types';

const renderWorkbenchRoute = (params: {
  loader: LazyRouteLoader;
  routePath: string;
  definition: WorkbenchDefinition;
}) => {
  const WorkbenchHost = React.lazy(loadWorkbenchHost);

  return (
    <Suspense fallback={<AppLoader />}>
      <WorkbenchHost definition={params.definition}>{withRouteFallback(params.loader, params.routePath)}</WorkbenchHost>
    </Suspense>
  );
};
```

And update the conversation route:

```tsx
<Route
  path='/conversation/:id'
  element={renderWorkbenchRoute({
    loader: loadConversation,
    routePath: '/conversation/:id',
    definition: conversationCoworkWorkbench,
  })}
/>
```

- [ ] **Step 6: Re-run the targeted tests to verify the definition model passes**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx \
  tests/unit/renderer/layout/Router.dom.test.tsx
```

Expected: PASS with `WorkbenchHost` now exposing the full definition and the router passing the built-in conversation definition.

- [ ] **Step 7: Commit the definition-model slice**

```bash
git add \
  src/renderer/pages/WorkbenchHost/types.ts \
  src/renderer/pages/WorkbenchHost/definitions.ts \
  src/renderer/pages/WorkbenchHost/context.ts \
  src/renderer/pages/WorkbenchHost/index.tsx \
  src/renderer/components/layout/Router.tsx \
  tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx \
  tests/unit/renderer/layout/Router.dom.test.tsx
git commit -m "refactor(workbench): add definition model"
```

### Task 3: Run Shell Regressions And Type Verification

**Files:**

- Verify: `tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx`
- Verify: `tests/unit/renderer/layout/Router.dom.test.tsx`
- Verify: `tests/unit/renderer/layout/Sider.dom.test.tsx`
- Verify: `tests/unit/renderer/Titlebar.dom.test.tsx`

- [ ] **Step 1: Run the renderer regression set that guards shell behavior**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/workbench/WorkbenchHost.dom.test.tsx \
  tests/unit/renderer/layout/Router.dom.test.tsx \
  tests/unit/renderer/layout/Sider.dom.test.tsx \
  tests/unit/renderer/Titlebar.dom.test.tsx
```

Expected: PASS, proving phase 2 did not change the existing shell or conversation layout behavior.

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
bunx tsc --noEmit --pretty false
```

Expected: Exit code `0`.
