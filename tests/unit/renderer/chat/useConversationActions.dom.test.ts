/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TChatConversation } from '@/common/config/storage';
import { useConversationActions } from '@/renderer/pages/conversation/GroupedHistory/hooks/useConversationActions';

const conversationGetInvoke = vi.fn();
const conversationRemoveInvoke = vi.fn();
const conversationUpdateInvoke = vi.fn();
const emitterEmit = vi.fn();
const messageSuccess = vi.fn();
const messageError = vi.fn();
const messageWarning = vi.fn();
const navigateMock = vi.fn();
const openTabMock = vi.fn();
const updateTabNameMock = vi.fn();
const useParamsMock = vi.fn(() => ({}));

vi.mock('@/common', () => ({
  ipcBridge: {
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

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    emit: (...args: unknown[]) => emitterEmit(...args),
  },
}));

vi.mock('@/renderer/utils/ui/focus', () => ({
  blockMobileInputFocus: vi.fn(),
  blurActiveElement: vi.fn(),
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    success: (...args: unknown[]) => messageSuccess(...args),
    error: (...args: unknown[]) => messageError(...args),
    warning: (...args: unknown[]) => messageWarning(...args),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'conversation.history.batchDeleteSuccess') {
        return `batchDeleteSuccess:${String(options?.count ?? '')}`;
      }
      return key;
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
  useParams: () => useParamsMock(),
}));

vi.mock('@/renderer/pages/conversation/hooks/ConversationTabsContext', () => ({
  useConversationTabs: () => ({
    openTab: openTabMock,
    updateTabName: updateTabNameMock,
  }),
}));

vi.mock('@/renderer/pages/conversation/GroupedHistory/utils/groupingHelpers', () => ({
  isConversationPinned: () => false,
}));

const createConversation = (id: string): TChatConversation =>
  ({
    id,
    name: `Conversation ${id}`,
    createTime: 1,
    modifyTime: 1,
    type: 'gemini',
    extra: {
      workspace: `/workspace/${id}`,
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
  }) as TChatConversation;

describe('useConversationActions delete modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useParamsMock.mockReturnValue({});
    conversationGetInvoke.mockImplementation(({ id }: { id: string }) => Promise.resolve(createConversation(id)));
    conversationRemoveInvoke.mockResolvedValue(true);
    conversationUpdateInvoke.mockResolvedValue(true);
  });

  it('opens a single delete modal after loading the conversation', async () => {
    const conversation = createConversation('conv-1');
    conversationGetInvoke.mockResolvedValueOnce(conversation);

    const setSelectedConversationIds = vi.fn() as React.Dispatch<React.SetStateAction<Set<string>>>;
    const { result } = renderHook(() =>
      useConversationActions({
        batchMode: false,
        selectedConversationIds: new Set<string>(),
        setSelectedConversationIds,
        toggleSelectedConversation: vi.fn(),
        markAsRead: vi.fn(),
      })
    );

    act(() => {
      result.current.handleDeleteClick('conv-1');
    });

    await waitFor(() => {
      expect(result.current.deleteModalState).toEqual({ kind: 'single', conversation });
    });

    expect(messageError).not.toHaveBeenCalled();
  });

  it('confirms single delete and refreshes the history', async () => {
    useParamsMock.mockReturnValue({ id: 'conv-2' });
    const conversation = createConversation('conv-2');
    conversationGetInvoke.mockResolvedValue(conversation);

    const setSelectedConversationIds = vi.fn() as React.Dispatch<React.SetStateAction<Set<string>>>;
    const { result } = renderHook(() =>
      useConversationActions({
        batchMode: false,
        selectedConversationIds: new Set<string>(),
        setSelectedConversationIds,
        toggleSelectedConversation: vi.fn(),
        markAsRead: vi.fn(),
      })
    );

    act(() => {
      result.current.handleDeleteClick('conv-2');
    });

    await waitFor(() => {
      expect(result.current.deleteModalState).toEqual({ kind: 'single', conversation });
    });

    await act(async () => {
      await result.current.handleDeleteModalConfirm();
    });

    expect(conversationRemoveInvoke).toHaveBeenCalledWith({ id: 'conv-2' });
    expect(emitterEmit).toHaveBeenCalledWith('conversation.deleted', 'conv-2');
    expect(emitterEmit).toHaveBeenCalledWith('chat.history.refresh');
    expect(messageSuccess).toHaveBeenCalledWith('conversation.history.deleteSuccess');
    expect(navigateMock).toHaveBeenCalledWith('/');
    expect(result.current.deleteModalState).toBeNull();
  });

  it('confirms batch delete and clears the current selection', async () => {
    const setSelectedConversationIds = vi.fn() as React.Dispatch<React.SetStateAction<Set<string>>>;
    const onBatchModeChange = vi.fn();
    const selectedConversationIds = new Set(['conv-1', 'conv-2']);

    const { result } = renderHook(() =>
      useConversationActions({
        batchMode: true,
        onBatchModeChange,
        selectedConversationIds,
        setSelectedConversationIds,
        toggleSelectedConversation: vi.fn(),
        markAsRead: vi.fn(),
      })
    );

    act(() => {
      result.current.handleBatchDelete();
    });

    expect(result.current.deleteModalState).toEqual({ kind: 'batch', count: 2 });

    await act(async () => {
      await result.current.handleDeleteModalConfirm();
    });

    expect(conversationRemoveInvoke).toHaveBeenCalledTimes(2);
    expect(conversationRemoveInvoke).toHaveBeenNthCalledWith(1, { id: 'conv-1' });
    expect(conversationRemoveInvoke).toHaveBeenNthCalledWith(2, { id: 'conv-2' });
    expect(messageSuccess).toHaveBeenCalledWith('batchDeleteSuccess:2');
    expect(setSelectedConversationIds).toHaveBeenCalledTimes(1);
    expect(onBatchModeChange).toHaveBeenCalledWith(false);
    expect(result.current.deleteModalState).toBeNull();
  });
});
