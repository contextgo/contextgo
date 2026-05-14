import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useLayoutContextMock = vi.fn();
const usePreviewSurfaceMock = vi.fn();
const useWorkspaceCollapseMock = vi.fn();
const useContainerWidthMock = vi.fn();
const useConversationTabsMock = vi.fn();
const useTitleRenameMock = vi.fn();
const useResizableSplitMock = vi.fn();
const calcLayoutMetricsMock = vi.fn();

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => useLayoutContextMock(),
}));

vi.mock('@/renderer/hooks/ui/useResizableSplit', () => ({
  useResizableSplit: () => useResizableSplitMock(),
}));

vi.mock('@/renderer/pages/conversation/hooks/useContainerWidth', () => ({
  useContainerWidth: () => useContainerWidthMock(),
}));

vi.mock('@/renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => useConversationTabsMock(),
}));

vi.mock('@/renderer/pages/conversation/hooks/useTitleRename', () => ({
  useTitleRename: () => useTitleRenameMock(),
}));

vi.mock('@/renderer/pages/conversation/hooks/usePreviewAutoCollapse', () => ({
  usePreviewAutoCollapse: vi.fn(),
}));

vi.mock('@/renderer/pages/conversation/hooks/useLayoutConstraints', () => ({
  useLayoutConstraints: vi.fn(),
}));

vi.mock('@/renderer/pages/conversation/hooks/useWorkspaceCollapse', () => ({
  useWorkspaceCollapse: () => useWorkspaceCollapseMock(),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewSurface: () => usePreviewSurfaceMock(),
  PreviewPanel: () => <div data-testid='preview-panel' />,
}));

vi.mock('@/renderer/pages/conversation/components/ConversationTabs', () => ({
  __esModule: true,
  default: ({ mobileEmbedded }: { mobileEmbedded?: boolean }) => (
    <div data-testid='conversation-tabs' data-embedded={mobileEmbedded ? 'true' : 'false'}>
      tabs
    </div>
  ),
}));

vi.mock('@/renderer/pages/conversation/components/ChatLayout/MobileWorkspaceOverlay', () => ({
  __esModule: true,
  default: () => <div data-testid='mobile-workspace-overlay' />,
}));

vi.mock('@/renderer/pages/conversation/components/ChatLayout/WorkspacePanelHeader', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid='workspace-panel-header'>{children}</div>,
  DesktopWorkspaceToggle: () => <div data-testid='desktop-workspace-toggle' />,
}));

vi.mock('@/renderer/pages/conversation/utils/detectPlatform', () => ({
  isMacEnvironment: () => false,
  isWindowsEnvironment: () => false,
}));

vi.mock('@/renderer/pages/conversation/utils/layoutCalc', () => ({
  MIN_WORKSPACE_RATIO: 20,
  WORKSPACE_HEADER_HEIGHT: 44,
  calcLayoutMetrics: (...args: unknown[]) => calcLayoutMetricsMock(...args),
}));

vi.mock('@/renderer/utils/workspace/workspaceEvents', () => ({
  dispatchWorkspaceToggleEvent: vi.fn(),
}));

vi.mock('@/renderer/components/layout/FlexFullContainer', () => ({
  __esModule: true,
  default: ({
    children,
    className,
    containerClassName,
  }: {
    children?: React.ReactNode;
    className?: string;
    containerClassName?: string;
  }) => (
    <div className={className}>
      <div className={containerClassName}>{children}</div>
    </div>
  ),
}));

vi.mock('@icon-park/react', () => ({
  ExpandLeft: () => <span>left</span>,
  ExpandRight: () => <span>right</span>,
}));

vi.mock('@arco-design/web-react', () => ({
  Layout: Object.assign(
    ({ children, className, style }: React.ComponentProps<'div'>) => (
      <div className={className} style={style}>
        {children}
      </div>
    ),
    {
      Header: ({ children, className, style }: React.ComponentProps<'div'>) => (
        <div className={className} style={style}>
          {children}
        </div>
      ),
      Content: ({ children, className, style, onClick }: React.ComponentProps<'div'>) => (
        <div className={className} style={style} onClick={onClick}>
          {children}
        </div>
      ),
      Sider: ({ children, className, style }: React.ComponentProps<'div'>) => (
        <div className={className} style={style}>
          {children}
        </div>
      ),
    }
  ),
}));

import ChatLayout from '@/renderer/pages/conversation/components/ChatLayout';

describe('ChatLayout mobile header composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <div id="shell-titlebar-primary-slot"></div>
      <div id="shell-toolbar-slot"></div>
    `;

    useLayoutContextMock.mockReturnValue({
      isMobile: true,
      siderCollapsed: true,
      setSiderCollapsed: vi.fn(),
      activeWorkbenchDefinition: null,
    });

    usePreviewSurfaceMock.mockReturnValue({
      isOpen: false,
    });

    useWorkspaceCollapseMock.mockReturnValue({
      rightSiderCollapsed: true,
      setRightSiderCollapsed: vi.fn(),
    });

    useContainerWidthMock.mockReturnValue({
      containerRef: { current: null },
      containerWidth: 390,
    });

    useConversationTabsMock.mockReturnValue({
      openTabs: [{ id: 'conv-1', name: 'Conversation 1' }],
      updateTabName: vi.fn(),
    });

    useTitleRenameMock.mockReturnValue({
      editingTitle: false,
      setEditingTitle: vi.fn(),
      titleDraft: 'Conversation 1',
      setTitleDraft: vi.fn(),
      renameLoading: false,
      canRenameTitle: false,
      submitTitleRename: vi.fn(),
    });

    useResizableSplitMock.mockReturnValue({
      splitRatio: 50,
      setSplitRatio: vi.fn(),
      createDragHandle: vi.fn(() => null),
    });

    calcLayoutMetricsMock.mockReturnValue({
      dynamicChatMinRatio: 30,
      dynamicChatMaxRatio: 70,
      chatFlex: 100,
      workspaceFlex: 0,
      workspaceWidthPx: 0,
      titleAreaMaxWidth: 280,
      mobileWorkspaceHandleRight: 0,
    });
  });

  it('hides conversation tabs on mobile and keeps only chat controls', () => {
    const { container } = render(
      <ChatLayout
        title='Conversation 1'
        sider={<div>workspace</div>}
        headerLeft={<div>model-pill</div>}
        headerExtra={<div>toolbar-extra</div>}
        workspaceEnabled={false}
        conversationId='conv-1'
      >
        <div>chat-body</div>
      </ChatLayout>
    );

    expect(screen.getByText('model-pill')).toBeInTheDocument();
    expect(screen.getByText('toolbar-extra')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-tabs')).toBeNull();

    const contextRow = container.querySelector('.chat-layout-mobile-context-row') as HTMLDivElement | null;
    expect(contextRow).toBeTruthy();
    expect(contextRow?.querySelector('.chat-layout-mobile-toolbar')).toBeTruthy();
    expect(container.querySelector('.chat-layout-header--mobile-unified')).toBeNull();
  });

  it('mounts desktop header and toolbar content into workbench-defined shell slots', () => {
    useLayoutContextMock.mockReturnValue({
      isMobile: false,
      siderCollapsed: false,
      setSiderCollapsed: vi.fn(),
      activeWorkbenchDefinition: {
        kind: 'conversation-cowork',
        capabilities: ['chat', 'preview', 'workspace', 'browser'],
        shellContract: {
          shellStyle: 'conversation',
          titlebar: {
            primarySlotId: 'shell-titlebar-primary-slot',
          },
          toolbar: {
            slotId: 'shell-toolbar-slot',
          },
        },
      },
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

    expect(document.getElementById('shell-titlebar-primary-slot')).toHaveTextContent('model-pill');
    expect(document.getElementById('shell-toolbar-slot')).toHaveTextContent('toolbar-extra');
  });
});
