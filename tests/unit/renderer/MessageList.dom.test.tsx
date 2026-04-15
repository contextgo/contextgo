/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutContext } from '../../../src/renderer/hooks/context/LayoutContext';
import MessageList from '../../../src/renderer/pages/conversation/Messages/MessageList';

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
  useConversationContextSafe: () => ({
    conversationId: 'conv-1',
    type: 'gemini',
  }),
}));

vi.mock('../../../src/renderer/pages/conversation/Messages/hooks', () => ({
  useMessageList: () => [],
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
    components,
  }: {
    className?: string;
    components?: {
      Scroller?: React.ComponentType<React.ComponentProps<'div'>>;
      Header?: React.ComponentType;
      Footer?: React.ComponentType;
    };
  }) => {
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
});
