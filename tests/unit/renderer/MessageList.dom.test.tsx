/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutContext } from '../../../src/renderer/hooks/context/LayoutContext';
import MessageList from '../../../src/renderer/pages/conversation/Messages/MessageList';

const virtuosoPropsHistory: Array<{
  components?: {
    Scroller?: React.ComponentType<React.ComponentProps<'div'>>;
    Header?: React.ComponentType;
    Footer?: React.ComponentType;
  };
  computeItemKey?: (index: number, item: { id: string }) => React.Key;
  data?: Array<{ id: string; type: string }>;
  initialTopMostItemIndex?: number;
  itemContent?: unknown;
}> = [];
const messageListMock: Array<{
  id: string;
  msg_id?: string;
  type: string;
  position: 'left' | 'right' | 'center';
  content: unknown;
}> = [];
const conversationContextMock = {
  conversationId: 'conv-1',
  type: 'gemini' as const,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Image: {
    PreviewGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  },
}));

vi.mock('@icon-park/react', () => ({
  Down: () => <span>down</span>,
}));

vi.mock('@/renderer/hooks/context/ConversationContext', () => ({
  useConversationContextSafe: () => conversationContextMock,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/hooks', () => ({
  useMessageList: () => messageListMock,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/useAutoScroll', () => ({
  useAutoScroll: () => ({
    virtuosoRef: { current: null },
    handleScroll: vi.fn(),
    handleAtBottomStateChange: vi.fn(),
    handleFollowOutput: vi.fn(),
    showScrollButton: false,
    scrollToBottom: vi.fn(),
    hideScrollButton: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    key: 'loc-1',
    state: {},
  }),
}));

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    className,
    computeItemKey,
    data,
    components,
    initialTopMostItemIndex,
    itemContent,
  }: {
    className?: string;
    computeItemKey?: (index: number, item: { id: string }) => React.Key;
    data?: Array<{ id: string; type: string }>;
    components?: {
      Scroller?: React.ComponentType<React.ComponentProps<'div'>>;
      Header?: React.ComponentType;
      Footer?: React.ComponentType;
    };
    initialTopMostItemIndex?: number;
    itemContent?: unknown;
  }) => {
    virtuosoPropsHistory.push({
      components,
      computeItemKey,
      data,
      initialTopMostItemIndex,
      itemContent,
    });
    const Scroller = components?.Scroller ?? 'div';
    const Header = components?.Header;
    const Footer = components?.Footer;

    return (
      <div data-testid='virtuoso-root' className={className}>
        <Scroller data-testid='virtuoso-scroller' style={{ overflowY: 'auto' }} />
        {Header ? <Header /> : null}
        {Footer ? <Footer /> : null}
      </div>
    );
  },
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/acp/MessageAcpPermission', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/acp/MessageAcpToolCall', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/codex/MessageFileChanges', () => ({
  default: () => null,
  parseDiff: vi.fn(() => []),
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessageAgentStatus', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessagePlan', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/schedule/MessageScheduleEvent', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessageTips', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessageToolCall', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessageToolGroup', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessageToolGroupSummary', () => ({
  default: () => null,
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/components/MessagetText', () => ({
  default: () => null,
  parseFileOperationMessage: vi.fn(() => null),
}));

const renderMessageList = (isMobile = false) =>
  render(
    <LayoutContext.Provider
      value={{
        isMobile,
        siderCollapsed: false,
        setSiderCollapsed: vi.fn(),
      }}
    >
      <MessageList />
    </LayoutContext.Provider>
  );

describe('MessageList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    virtuosoPropsHistory.length = 0;
    messageListMock.length = 0;
    conversationContextMock.conversationId = 'conv-1';
  });

  it('clamps horizontal overflow on the virtualized message scroller', () => {
    renderMessageList();

    const scroller = screen.getByTestId('virtuoso-scroller');
    const root = scroller.parentElement?.parentElement;

    expect(scroller.className).toContain('scrollbar-hide');
    expect(scroller).toHaveStyle({
      overflowX: 'hidden',
      overflowY: 'auto',
      overscrollBehaviorX: 'none',
      scrollbarWidth: 'none',
    });
    expect(root?.className).toContain('overflow-x-hidden');
  });

  it('locks the mobile message list to vertical pan gestures', () => {
    renderMessageList(true);

    expect(screen.getByTestId('virtuoso-scroller')).toHaveStyle({
      touchAction: 'pan-y',
    });
  });

  it('keeps Virtuoso structural props stable across rerenders', () => {
    const view = renderMessageList();

    const firstRender = virtuosoPropsHistory.at(-1);
    expect(firstRender).toBeDefined();

    view.rerender(
      <LayoutContext.Provider
        value={{
          isMobile: false,
          siderCollapsed: false,
          setSiderCollapsed: vi.fn(),
        }}
      >
        <MessageList />
      </LayoutContext.Provider>
    );

    const secondRender = virtuosoPropsHistory.at(-1);
    expect(secondRender).toBeDefined();
    expect(secondRender?.components).toBe(firstRender?.components);
    expect(secondRender?.itemContent).toBe(firstRender?.itemContent);
  });

  it('uses stable processed item ids as Virtuoso keys', () => {
    messageListMock.push(
      {
        id: 'msg-1',
        type: 'text',
        position: 'left',
        content: { content: 'hello' },
      },
      {
        id: 'tool-1',
        type: 'tool_group',
        position: 'left',
        content: [{ name: 'ReadFile' }],
      }
    );

    renderMessageList();

    const latestRender = virtuosoPropsHistory.at(-1);
    expect(latestRender?.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'msg-1', type: 'text' }),
        expect.objectContaining({ id: 'step-summary-tool-1', type: 'step_summary' }),
      ])
    );
    expect(latestRender?.computeItemKey?.(0, latestRender.data?.[0] ?? { id: 'missing' })).toBe('msg-1');
    expect(latestRender?.computeItemKey?.(1, latestRender.data?.[1] ?? { id: 'missing' })).toBe('step-summary-tool-1');
  });

  it('filters runtime plan messages out of the chat transcript data', () => {
    messageListMock.push(
      {
        id: 'plan-1',
        msg_id: 'plan-msg-1',
        type: 'plan',
        position: 'left',
        content: {
          sessionId: 'session-1',
          entries: [{ content: 'Read schedule skill doc', status: 'pending' }],
        },
      },
      {
        id: 'msg-1',
        type: 'text',
        position: 'left',
        content: { content: 'hello' },
      }
    );

    renderMessageList();

    const latestRender = virtuosoPropsHistory.at(-1);
    expect(latestRender?.data).toEqual([expect.objectContaining({ id: 'msg-1', type: 'text' })]);
    expect(latestRender?.data?.some((item) => item.type === 'plan')).toBe(false);
  });

  it('applies the initial bottom position only on the first render for a conversation', () => {
    messageListMock.push(
      {
        id: 'msg-1',
        type: 'text',
        position: 'left',
        content: { content: 'hello' },
      },
      {
        id: 'msg-2',
        type: 'text',
        position: 'left',
        content: { content: 'world' },
      }
    );

    const view = renderMessageList();

    expect(virtuosoPropsHistory.at(-1)?.initialTopMostItemIndex).toBe(1);

    view.rerender(
      <LayoutContext.Provider
        value={{
          isMobile: false,
          siderCollapsed: false,
          setSiderCollapsed: vi.fn(),
        }}
      >
        <MessageList />
      </LayoutContext.Provider>
    );

    expect(virtuosoPropsHistory.at(-1)?.initialTopMostItemIndex).toBeUndefined();
  });

  it('re-applies the initial bottom position when switching to a different conversation', () => {
    messageListMock.push(
      {
        id: 'msg-1',
        type: 'text',
        position: 'left',
        content: { content: 'hello' },
      },
      {
        id: 'msg-2',
        type: 'text',
        position: 'left',
        content: { content: 'world' },
      }
    );

    const view = renderMessageList();
    expect(virtuosoPropsHistory.at(-1)?.initialTopMostItemIndex).toBe(1);

    conversationContextMock.conversationId = 'conv-2';

    view.rerender(
      <LayoutContext.Provider
        value={{
          isMobile: false,
          siderCollapsed: false,
          setSiderCollapsed: vi.fn(),
        }}
      >
        <MessageList />
      </LayoutContext.Provider>
    );

    expect(virtuosoPropsHistory.at(-1)?.initialTopMostItemIndex).toBe(1);
  });
});
