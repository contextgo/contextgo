import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { TChatConversation } from '@/common/config/storage';
import ConversationRow from '@/renderer/pages/conversation/GroupedHistory/ConversationRow';

vi.mock('@/renderer/hooks/agent/usePresetAssistantInfo', () => ({
  usePresetAssistantInfo: () => ({ info: null }),
}));

vi.mock('@/renderer/utils/model/agentLogo', () => ({
  getAgentLogo: () => null,
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('@/renderer/pages/cron', () => ({
  CronJobIndicator: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const createConversation = (overrides: Partial<TChatConversation> = {}): TChatConversation =>
  ({
    id: 'conv-1',
    name: 'Topic A',
    createTime: 1,
    modifyTime: 1,
    type: 'gemini',
    extra: {
      workspace: '/workspace/topic-a',
      customWorkspace: true,
    },
    model: {
      id: 'provider-1',
      platform: 'openai',
      name: 'Provider',
      baseUrl: 'https://example.com',
      apiKey: 'test-key',
      useModel: 'gpt-4o-mini',
    },
    ...overrides,
  }) as TChatConversation;

const createProps = (conversation: TChatConversation) => ({
  conversation,
  isGenerating: false,
  hasCompletionUnread: false,
  allowActions: false,
  allowBatchSelection: false,
  collapsed: false,
  tooltipEnabled: false,
  batchMode: false,
  checked: false,
  selected: false,
  menuVisible: false,
  onToggleChecked: vi.fn(),
  onConversationClick: vi.fn(),
  onOpenMenu: vi.fn(),
  onMenuVisibleChange: vi.fn(),
  onEditStart: vi.fn(),
  onDelete: vi.fn(),
  onExport: vi.fn(),
  onTogglePin: vi.fn(),
  onArchive: vi.fn(),
  getJobStatus: vi.fn(() => 'none' as const),
});

describe('ConversationRow', () => {
  it('uses native title metadata instead of mounting a portal tooltip for workspace rows', () => {
    const conversation = createConversation();
    const props = createProps(conversation);

    render(<ConversationRow {...props} />);

    const row = screen.getByTitle('/workspace/topic-a');
    fireEvent.mouseEnter(screen.getByText('Topic A'));
    fireEvent.click(screen.getByText('Topic A'));

    expect(row).toBeInTheDocument();
    expect(props.onConversationClick).toHaveBeenCalledWith(conversation);
    expect(document.querySelector('.arco-tooltip-popup')).toBeNull();
  });

  it('falls back to the conversation name when no workspace path is available', () => {
    render(
      <ConversationRow
        {...createProps(
          createConversation({
            extra: {
              customWorkspace: false,
            } as TChatConversation['extra'],
          })
        )}
      />
    );

    expect(screen.getByTitle('Topic A')).toBeInTheDocument();
  });
});
