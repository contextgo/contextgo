/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TChatConversation } from '@/common/config/storage';
import ChatHistory from '@/renderer/pages/conversation/components/ChatHistory';

const getUserConversationsInvoke = vi.fn();
const conversationGetInvoke = vi.fn();
const conversationRemoveInvoke = vi.fn();
const conversationUpdateInvoke = vi.fn();
const addEventListenerMock = vi.fn(() => vi.fn());
const emitterEmit = vi.fn();
const navigateMock = vi.fn();
const markAsReadMock = vi.fn();
const getJobStatusMock = vi.fn(() => 'none' as const);
const useParamsMock = vi.fn(() => ({}));

vi.mock('@/common', () => ({
  ipcBridge: {
    database: {
      getUserConversations: {
        invoke: (...args: unknown[]) => getUserConversationsInvoke(...args),
      },
    },
    conversation: {
      get: {
        invoke: (...args: unknown[]) => conversationGetInvoke(...args),
      },
      remove: {
        invoke: (...args: unknown[]) => conversationRemoveInvoke(...args),
      },
      update: {
        invoke: (...args: unknown[]) => conversationUpdateInvoke(...args),
      },
    },
  },
}));

vi.mock('@/renderer/pages/cron', () => ({
  CronJobIndicator: () => null,
  useCronJobsMap: () => ({
    getJobStatus: getJobStatusMock,
    markAsRead: markAsReadMock,
  }),
}));

vi.mock('@/renderer/utils/emitter', () => ({
  addEventListener: (...args: unknown[]) => addEventListenerMock(...args),
  emitter: {
    emit: (...args: unknown[]) => emitterEmit(...args),
  },
}));

vi.mock('@/renderer/utils/ui/focus', () => ({
  blockMobileInputFocus: vi.fn(),
  blurActiveElement: vi.fn(),
}));

vi.mock('@/renderer/utils/ui/siderTooltip', () => ({
  cleanupSiderTooltips: vi.fn(),
  getSiderTooltipProps: () => ({}),
}));

vi.mock('@/renderer/utils/chat/timeline', () => ({
  getActivityTime: (conversation: TChatConversation) => conversation.modifyTime,
  createTimelineGrouper: () => () => null,
}));

vi.mock('@/renderer/utils/workspace/workspace', () => ({
  getConversationWorkspacePath: () => '/workspace/conv-1',
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => useParamsMock(),
}));

vi.mock('@arco-design/web-react', () => ({
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Input: ({ value, onChange, onKeyDown, onBlur, autoFocus }: Record<string, unknown>) => (
    <input
      autoFocus={Boolean(autoFocus)}
      value={String(value ?? '')}
      onChange={(event) => onChange?.((event.target as HTMLInputElement).value)}
      onKeyDown={(event) => onKeyDown?.(event)}
      onBlur={(event) => onBlur?.(event)}
    />
  ),
  Message: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@icon-park/react', () => ({
  DeleteOne: (props: Record<string, unknown>) => <svg data-testid='delete-icon' {...props} />,
  MessageOne: () => <svg data-testid='message-icon' />,
  EditOne: () => <svg data-testid='edit-icon' />,
}));

vi.mock('@/renderer/components/layout/FlexFullContainer', () => ({
  __esModule: true,
  default: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock('@/renderer/pages/conversation/GroupedHistory/DeleteConversationModal', () => ({
  __esModule: true,
  default: ({
    visible,
    state,
    onConfirm,
    onCancel,
  }: {
    visible: boolean;
    state: { kind: 'single'; conversation: TChatConversation } | { kind: 'batch'; count: number } | null;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    visible ? (
      <div data-testid='delete-modal'>
        <span>{state?.kind}</span>
        <button type='button' onClick={onConfirm}>
          confirm-delete
        </button>
        <button type='button' onClick={onCancel}>
          cancel-delete
        </button>
      </div>
    ) : null,
}));

const createConversation = (overrides: Partial<TChatConversation> = {}): TChatConversation =>
  ({
    id: 'conv-1',
    name: 'Conversation 1',
    createTime: 1,
    modifyTime: 2,
    type: 'gemini',
    extra: {
      workspace: '/workspace/conv-1',
      customWorkspace: true,
    },
    model: {
      id: 'model-1',
      platform: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://example.com',
      apiKey: 'test-key',
      useModel: 'gpt-4o-mini',
    },
    ...overrides,
  }) as TChatConversation;

describe('ChatHistory delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsMock.mockReturnValue({ id: 'conv-1' });
    const conversation = createConversation();
    getUserConversationsInvoke.mockResolvedValue([conversation]);
    conversationGetInvoke.mockResolvedValue(conversation);
    conversationRemoveInvoke.mockResolvedValue(true);
    conversationUpdateInvoke.mockResolvedValue(true);
  });

  it('opens the shared delete modal instead of using Popconfirm', async () => {
    render(<ChatHistory />);

    await screen.findByText('Conversation 1');

    fireEvent.click(screen.getByLabelText('conversation.history.deleteTitle'));

    await waitFor(() => {
      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    });
    expect(screen.getByText('single')).toBeInTheDocument();
  });

  it('confirms deletion through the shared modal flow', async () => {
    render(<ChatHistory />);

    await screen.findByText('Conversation 1');

    fireEvent.click(screen.getByLabelText('conversation.history.deleteTitle'));
    await screen.findByTestId('delete-modal');

    fireEvent.click(screen.getByRole('button', { name: 'confirm-delete' }));

    await waitFor(() => {
      expect(conversationRemoveInvoke).toHaveBeenCalledWith({ id: 'conv-1' });
    });
    expect(emitterEmit).toHaveBeenCalledWith('conversation.deleted', 'conv-1');
    expect(emitterEmit).toHaveBeenCalledWith('chat.history.refresh');
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
