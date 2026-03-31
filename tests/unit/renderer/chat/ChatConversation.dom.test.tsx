import type { TChatConversation } from '@/common/config/storage';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const openPreviewMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewContext: () => ({
    openPreview: openPreviewMock,
  }),
}));

vi.mock('@/renderer/hooks/agent/usePresetAssistantInfo', () => ({
  usePresetAssistantInfo: (conversation?: TChatConversation) => ({
    info: conversation
      ? {
          name: `${conversation.type}-agent`,
          logo: undefined,
          isEmoji: false,
        }
      : undefined,
    isLoading: false,
  }),
}));

vi.mock('@/renderer/pages/cron', () => ({
  CronJobManager: ({ conversation }: { conversation: TChatConversation }) => (
    <div data-testid='cron-job-manager'>{conversation.id}</div>
  ),
}));

vi.mock('@/renderer/pages/conversation/components/ChatLayout', () => ({
  __esModule: true,
  default: ({
    title,
    children,
    headerLeft,
    headerExtra,
  }: {
    title?: React.ReactNode;
    children: React.ReactNode;
    headerLeft?: React.ReactNode;
    headerExtra?: React.ReactNode;
  }) => (
    <div data-testid='chat-layout'>
      <div data-testid='chat-layout-title'>{title}</div>
      <div data-testid='chat-layout-header-left'>{headerLeft}</div>
      <div data-testid='chat-layout-header-extra'>{headerExtra}</div>
      <div data-testid='chat-layout-children'>{children}</div>
    </div>
  ),
}));

vi.mock('@/renderer/pages/conversation/components/ChatSider', () => ({
  __esModule: true,
  default: () => <div data-testid='chat-sider' />,
}));

vi.mock('@/renderer/pages/conversation/platforms/acp/AcpChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => <div data-testid='acp-chat'>{conversation_id}</div>,
}));

vi.mock('@/renderer/pages/conversation/platforms/codex/CodexChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => <div data-testid='codex-chat'>{conversation_id}</div>,
}));

vi.mock('@/renderer/pages/conversation/platforms/nanobot/NanobotChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => (
    <div data-testid='nanobot-chat'>{conversation_id}</div>
  ),
}));

vi.mock('@/renderer/pages/conversation/platforms/openclaw/OpenClawChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => (
    <div data-testid='openclaw-chat'>{conversation_id}</div>
  ),
}));

vi.mock('@/renderer/pages/conversation/platforms/group/GroupChat', () => ({
  __esModule: true,
  default: ({ conversation }: { conversation: Extract<TChatConversation, { type: 'group' }> }) => (
    <div data-testid='group-chat'>{conversation.id}</div>
  ),
}));

vi.mock('@/renderer/components/agent/AcpModelSelector', () => ({
  __esModule: true,
  default: () => <div data-testid='acp-model-selector' />,
}));

vi.mock('@/renderer/pages/conversation/platforms/gemini/GeminiModelSelector', () => ({
  __esModule: true,
  default: ({ disabled }: { disabled?: boolean; selection?: unknown }) => (
    <div data-testid='gemini-model-selector'>{disabled ? 'disabled' : 'enabled'}</div>
  ),
}));

vi.mock('@/renderer/pages/conversation/platforms/gemini/useGeminiModelSelection', () => ({
  useGeminiModelSelection: () => ({
    currentModel: { id: 'gemini', useModel: 'gemini-2.5-pro' },
    providers: [],
    geminiModeLookup: new Map(),
    getAvailableModels: () => [],
    handleSelectModel: vi.fn(),
    formatModelLabel: () => 'Gemini 2.5 Pro',
  }),
}));

vi.mock('@/renderer/pages/conversation/platforms/gemini/GeminiChat', () => ({
  __esModule: true,
  default: ({ conversation_id }: { conversation_id: string }) => <div data-testid='gemini-chat'>{conversation_id}</div>,
}));

vi.mock('@/renderer/pages/conversation/platforms/openclaw/StarOfficeMonitorCard.tsx', () => ({
  __esModule: true,
  default: () => <div data-testid='staroffice-monitor-card' />,
}));

vi.mock('@/renderer/pages/conversation/platforms/ConversationBrowserContextButton', () => ({
  __esModule: true,
  default: () => <div data-testid='browser-context-button' />,
}));

import ChatConversation from '@/renderer/pages/conversation/components/ChatConversation';

const createConversation = (type: TChatConversation['type'], id: string): TChatConversation =>
  ({
    id,
    type,
    name: `${type}-${id}`,
    extra: {
      workspace: `/tmp/${id}`,
    },
    model: {
      id: 'provider-1',
      name: 'Provider One',
      platform: type,
      useModel: `${type}-model`,
    },
  }) as TChatConversation;

describe('ChatConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps hook order stable when switching from a gemini conversation to a non-gemini conversation', () => {
    const geminiConversation = createConversation('gemini', 'gemini-1') as Extract<
      TChatConversation,
      { type: 'gemini' }
    >;
    const acpConversation = createConversation('acp', 'acp-1');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const { rerender } = render(<ChatConversation conversation={geminiConversation} />);

      expect(screen.getByTestId('gemini-chat')).toHaveTextContent('gemini-1');

      expect(() => {
        rerender(<ChatConversation conversation={acpConversation} />);
      }).not.toThrow();

      expect(screen.getByTestId('acp-chat')).toHaveTextContent('acp-1');
      expect(
        consoleErrorSpy.mock.calls.some((args) =>
          args.some((arg) => String(arg).includes('Rendered more hooks than during the previous render'))
        )
      ).toBe(false);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
