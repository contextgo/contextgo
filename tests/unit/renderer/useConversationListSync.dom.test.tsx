/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TChatConversation } from '@/common/config/storage';

const getUserConversationsInvoke = vi.fn<() => Promise<TChatConversation[]>>();

const responseStreamListeners = new Set<(message: { conversation_id?: string; type: string; data: unknown }) => void>();
const listChangedListeners = new Set<(event: { action: string; conversationId: string }) => void>();
const turnCompletedListeners = new Set<(event: { sessionId: string; state: string }) => void>();

vi.mock('@/common', () => ({
  ipcBridge: {
    database: {
      getUserConversations: {
        invoke: (...args: unknown[]) => getUserConversationsInvoke(...args),
      },
    },
    conversation: {
      listChanged: {
        on: (listener: (event: { action: string; conversationId: string }) => void) => {
          listChangedListeners.add(listener);
          return () => listChangedListeners.delete(listener);
        },
      },
      responseStream: {
        on: (listener: (message: { conversation_id?: string; type: string; data: unknown }) => void) => {
          responseStreamListeners.add(listener);
          return () => responseStreamListeners.delete(listener);
        },
      },
      turnCompleted: {
        on: (listener: (event: { sessionId: string; state: string }) => void) => {
          turnCompletedListeners.add(listener);
          return () => turnCompletedListeners.delete(listener);
        },
      },
    },
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  addEventListener: () => () => {},
}));

const makeConversation = (): TChatConversation =>
  ({
    id: 'openclaw-conv-1',
    name: 'OpenClaw Session',
    type: 'openclaw-gateway',
    status: 'idle',
    createTime: Date.now(),
    modifyTime: Date.now(),
    extra: {
      workspace: '/tmp/openclaw',
      customWorkspace: false,
      backend: 'openclaw-gateway',
    },
    model: {
      id: 'gpt-5',
      name: 'GPT-5',
      useModel: 'gpt-5',
      platform: 'openai',
      baseUrl: '',
      apiKey: '',
    },
  }) as TChatConversation;

describe('useConversationListSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    responseStreamListeners.clear();
    listChangedListeners.clear();
    turnCompletedListeners.clear();
    getUserConversationsInvoke.mockResolvedValue([makeConversation()]);
  });

  it('marks regular streamed content as generating and clears it on finish', async () => {
    const { useConversationListSync } =
      await import('@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync');
    const { result } = renderHook(() => useConversationListSync());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'content',
          data: 'hello',
        })
      );
    });

    expect(result.current.isConversationGenerating('openclaw-conv-1')).toBe(true);

    act(() => {
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'finish',
          data: null,
        })
      );
    });

    expect(result.current.isConversationGenerating('openclaw-conv-1')).toBe(false);
  });

  it('clears generating state when an interrupted event arrives', async () => {
    const { useConversationListSync } =
      await import('@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync');
    const { result } = renderHook(() => useConversationListSync());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'content',
          data: 'hello',
        })
      );
    });

    expect(result.current.isConversationGenerating('openclaw-conv-1')).toBe(true);

    act(() => {
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'interrupted',
          data: 'Interrupted by user.',
        })
      );
    });

    expect(result.current.isConversationGenerating('openclaw-conv-1')).toBe(false);
  });

  it('does not keep OpenClaw conversations generating during bootstrap agent statuses', async () => {
    const { useConversationListSync } =
      await import('@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync');
    const { result } = renderHook(() => useConversationListSync());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'agent_status',
          data: {
            backend: 'openclaw-gateway',
            status: 'connecting',
          },
        })
      );
    });

    expect(result.current.isConversationGenerating('openclaw-conv-1')).toBe(false);

    act(() => {
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'content',
          data: 'running',
        })
      );
    });

    expect(result.current.isConversationGenerating('openclaw-conv-1')).toBe(true);

    act(() => {
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'agent_status',
          data: {
            backend: 'openclaw-gateway',
            status: 'session_active',
          },
        })
      );
    });

    expect(result.current.isConversationGenerating('openclaw-conv-1')).toBe(false);
  });

  it('ignores model-info and codex bootstrap events when opening a conversation', async () => {
    const { useConversationListSync } =
      await import('@/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync');
    const { result } = renderHook(() => useConversationListSync());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    act(() => {
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'acp_model_info',
          data: {
            currentModelId: 'gpt-5',
            currentModelLabel: 'GPT-5',
            availableModels: [],
            canSwitch: false,
            source: 'models',
          },
        })
      );
      responseStreamListeners.forEach((listener) =>
        listener({
          conversation_id: 'openclaw-conv-1',
          type: 'agent_status',
          data: {
            backend: 'codex',
            status: 'connecting',
          },
        })
      );
    });

    expect(result.current.isConversationGenerating('openclaw-conv-1')).toBe(false);
  });
});
