# Workbench Host Phase 3B Browser Capability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the conversation workbench expose `browser` as a lightweight, always-visible header capability chip with a visible bound-state label, without changing the existing browser asset and URL preview flow.

**Architecture:** Keep the browser capability inside the existing conversation header addon layer. Update `conversationHeaderAddons.tsx` so the browser addon is always present for conversation-cowork, then evolve `ConversationBrowserContextButton.tsx` into a two-state chip that reuses the current `assertBindable`, `create`, `update`, `conversation.update`, and `openUrlPreview` flow. Leave PreviewPanel, routes, and browser asset storage unchanged.

**Tech Stack:** React, TypeScript, Vitest, Arco Design

---

### Task 1: Add Failing Browser Capability Visibility And State Tests

**Files:**

- Modify: `tests/unit/renderer/chat/ChatConversation.dom.test.tsx`
- Modify: `tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx`

- [ ] **Step 1: Add a ChatConversation regression that expects the browser addon even without a bound asset**

Extend `tests/unit/renderer/chat/ChatConversation.dom.test.tsx` so the mocked browser button must appear for an unbound conversation:

```tsx
it('renders the browser capability addon even before a browser context is bound', () => {
  const conversation = createConversation('acp', 'acp-browser-unbound');

  render(<ChatConversation conversation={conversation} />);

  expect(screen.getByTestId('browser-context-button')).toBeInTheDocument();
});
```

- [ ] **Step 2: Add a button-level regression for the visible unbound and bound states**

Extend `tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx` with two assertions:

```tsx
it('shows an unbound browser capability chip before any browser asset is linked', () => {
  render(<ConversationBrowserContextButton conversation={createConversation()} onOpenUrl={onOpenUrlMock} />);

  expect(screen.getByRole('button', { name: /Browser/i })).toBeInTheDocument();
  expect(screen.queryByText(/Browser:/i)).toBeNull();
});

it('shows the bound browser asset label when a browser context is already linked', async () => {
  browserContextAssertBindableInvokeMock.mockResolvedValue({
    success: true,
    data: {
      id: 'asset-9',
      label: 'Bound Browser',
      metadata: {
        homeUrl: 'https://bound.example.com',
      },
    } satisfies Partial<TBrowserContextAsset>,
  });

  render(
    <ConversationBrowserContextButton
      conversation={createConversation({
        extra: {
          spaceId: 'space-alpha',
          browserContextAssetId: 'asset-9',
        },
      })}
      onOpenUrl={onOpenUrlMock}
    />
  );

  expect(screen.getByRole('button', { name: /Bound Browser/i })).toBeInTheDocument();
});
```

- [ ] **Step 3: Add a regression for the lightweight reconfigure action**

Still in `tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx`, add a bound-state interaction test:

```tsx
it('opens the lightweight browser reconfigure flow for a bound asset', async () => {
  browserContextAssertBindableInvokeMock.mockResolvedValue({
    success: true,
    data: {
      id: 'asset-9',
      label: 'Bound Browser',
      metadata: {
        homeUrl: 'https://bound.example.com',
      },
    } satisfies Partial<TBrowserContextAsset>,
  });

  render(
    <ConversationBrowserContextButton
      conversation={createConversation({
        extra: {
          spaceId: 'space-alpha',
          browserContextAssetId: 'asset-9',
        },
      })}
      onOpenUrl={onOpenUrlMock}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /configure browser/i }));

  expect(await screen.findByTestId('contextgo-modal')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the targeted browser tests to verify RED**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/chat/ChatConversation.dom.test.tsx \
  tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx
```

Expected: FAIL because the browser addon is still hidden for unbound conversations and the browser button still renders as a minimal icon-only action with no visible bound-state label or lightweight reconfigure entry.

### Task 2: Implement The Two-State Browser Capability Chip

**Files:**

- Modify: `src/renderer/pages/conversation/platforms/conversationHeaderAddons.tsx`
- Modify: `src/renderer/pages/conversation/platforms/ConversationBrowserContextButton.tsx`

- [ ] **Step 1: Make the conversation header always render the browser capability addon**

Update `src/renderer/pages/conversation/platforms/conversationHeaderAddons.tsx` so the browser addon no longer depends on `browserContextAssetId`:

```tsx
const headerAddonDefinitions: HeaderAddonDefinition[] = [
  {
    id: 'browser-context',
    shouldRender: ({ conversation }) => conversation.type !== 'group',
    render: ({ conversation, openUrlPreview }) => (
      <ConversationBrowserContextButton conversation={conversation} onOpenUrl={openUrlPreview} />
    ),
  },
  {
    id: 'group-workflow',
    shouldRender: ({ conversation }) =>
      conversation.type === 'group' && conversation.extra.orchestration.kind === 'workflow',
    render: ({ conversation }) => renderWorkflowHeaderAddon(conversation),
  },
];
```

- [ ] **Step 2: Add explicit chip-state helpers for the browser capability**

In `src/renderer/pages/conversation/platforms/ConversationBrowserContextButton.tsx`, add lightweight display helpers:

```tsx
const truncateBrowserLabel = (label: string): string => {
  const trimmed = label.trim();
  if (trimmed.length <= 28) {
    return trimmed;
  }
  return `${trimmed.slice(0, 27).trimEnd()}…`;
};

const getBrowserChipLabel = (assetLabel?: string): string => {
  return assetLabel ? `Browser: ${truncateBrowserLabel(assetLabel)}` : 'Browser';
};
```

- [ ] **Step 3: Render the primary capability chip and the lightweight reconfigure action**

Replace the icon-only button with a two-part, still-lightweight UI:

```tsx
const isBound = Boolean(boundAssetId);
const chipLabel = getBrowserChipLabel(draft?.label);

return (
  <>
    <div className='flex items-center gap-6px'>
      <Tooltip content={t('conversation.browser.open')}>
        <Button
          size='mini'
          className='app-icon-row'
          onClick={() => {
            void handleOpenBrowser();
          }}
        >
          <Earth
            theme='outline'
            size='14'
            fill={iconColors.primary}
            strokeWidth={2}
            strokeLinejoin='miter'
            strokeLinecap='square'
          />
          <span title={chipLabel}>{chipLabel}</span>
        </Button>
      </Tooltip>

      {isBound ? (
        <Tooltip content={t('conversation.browser.configureTitle')}>
          <Button
            size='mini'
            aria-label='configure browser'
            onClick={() => {
              void handleConfigureBrowser();
            }}
          >
            <span>{t('common.configure', { defaultValue: 'Configure' })}</span>
          </Button>
        </Tooltip>
      ) : null}
    </div>
```

Keep the existing modal and `handleConfirm` flow.

- [ ] **Step 4: Add a dedicated configure handler that reuses the current asset-update flow**

Still in `ConversationBrowserContextButton.tsx`, add:

```tsx
const handleConfigureBrowser = useCallback(async () => {
  const spaceId = conversation.extra?.spaceId;
  if (!spaceId || !boundAssetId) {
    return;
  }

  try {
    const bindableResponse = await ipcBridge.browserContext.assertBindable.invoke({
      id: boundAssetId,
      spaceId,
    });

    if (!bindableResponse.success || !bindableResponse.data) {
      Message.warning(bindableResponse.msg || t('conversation.browser.openFailed'));
      return;
    }

    const asset = bindableResponse.data;
    setDraft({
      id: asset.id,
      label: asset.label,
      metadata: asset.metadata,
    });
    setStartUrl(getHomeUrl(asset) || 'https://');
    setVisible(true);
  } catch (error) {
    Message.error(error instanceof Error ? error.message : t('conversation.browser.openFailed'));
  }
}, [boundAssetId, conversation.extra?.spaceId, t]);
```

This preserves the existing `handleConfirm()` update path.

- [ ] **Step 5: Re-run the targeted browser tests to verify GREEN**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/chat/ChatConversation.dom.test.tsx \
  tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx
```

Expected: PASS with the browser addon always visible, the bound-state label rendered, and the lightweight reconfigure action opening the existing modal flow.

- [ ] **Step 6: Commit the browser capability slice**

```bash
git add \
  src/renderer/pages/conversation/platforms/conversationHeaderAddons.tsx \
  src/renderer/pages/conversation/platforms/ConversationBrowserContextButton.tsx \
  tests/unit/renderer/chat/ChatConversation.dom.test.tsx \
  tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx
git commit -m "feat(workbench): surface browser capability chip"
```

### Task 3: Run Regression And Type Verification

**Files:**

- Verify: `tests/unit/renderer/chat/ChatConversation.dom.test.tsx`
- Verify: `tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx`
- Verify: `tests/unit/renderer/Titlebar.dom.test.tsx`
- Verify: `tests/unit/renderer/layout/ChatLayout.dom.test.tsx`

- [ ] **Step 1: Run the browser + workbench regression set**

Run:

```bash
bunx vitest run \
  tests/unit/renderer/chat/ChatConversation.dom.test.tsx \
  tests/unit/renderer/chat/ConversationBrowserContextButton.dom.test.tsx \
  tests/unit/renderer/Titlebar.dom.test.tsx \
  tests/unit/renderer/layout/ChatLayout.dom.test.tsx
```

Expected: PASS, proving the new browser capability chip does not regress the shell/workbench slot behavior introduced in phase 3A.

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
bunx tsc --noEmit --pretty false
```

Expected: Exit code `0`.
