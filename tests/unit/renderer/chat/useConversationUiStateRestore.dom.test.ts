/**
 * @vitest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConversationGetInvoke = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      get: {
        invoke: (...args: unknown[]) => mockConversationGetInvoke(...args),
      },
    },
  },
}));

import { writeConversationUiState } from '@/renderer/pages/conversation/hooks/conversationUiStateCache';
import { useConversationUiStateRestore } from '@/renderer/pages/conversation/hooks/useConversationUiStateRestore';

describe('useConversationUiStateRestore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConversationGetInvoke.mockResolvedValue({ status: 'running' });
  });

  it('does not rerun restore side effects on ordinary rerenders with fresh inline callbacks', async () => {
    const applyCachedState = vi.fn();
    const resetTransientState = vi.fn();
    const syncBackendState = vi.fn();

    writeConversationUiState('codex-test', 'conversation-1', { running: true });

    const { rerender } = renderHook(
      ({ state }) =>
        useConversationUiStateRestore({
          scope: 'codex-test',
          conversationId: 'conversation-1',
          state,
          createDefaultState: () => ({ running: false }),
          applyCachedState: (cachedState) => {
            applyCachedState(cachedState);
          },
          resetTransientState: () => {
            resetTransientState();
          },
          syncBackendState: (isRunning, hasCachedState) => {
            syncBackendState(isRunning, hasCachedState);
          },
        }),
      {
        initialProps: {
          state: { running: true },
        },
      }
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(applyCachedState).toHaveBeenCalledTimes(1);
    expect(resetTransientState).toHaveBeenCalledTimes(1);
    expect(syncBackendState).toHaveBeenCalledTimes(1);
    expect(mockConversationGetInvoke).toHaveBeenCalledTimes(1);

    rerender({
      state: { running: false },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(applyCachedState).toHaveBeenCalledTimes(1);
    expect(resetTransientState).toHaveBeenCalledTimes(1);
    expect(syncBackendState).toHaveBeenCalledTimes(1);
    expect(mockConversationGetInvoke).toHaveBeenCalledTimes(1);
  });

  it('reruns restore side effects when the conversation changes', async () => {
    const applyCachedState = vi.fn();

    writeConversationUiState('group-test', 'conversation-1', { running: true });
    writeConversationUiState('group-test', 'conversation-2', { running: false });

    const { rerender } = renderHook(
      ({ conversationId, state }) =>
        useConversationUiStateRestore({
          scope: 'group-test',
          conversationId,
          state,
          createDefaultState: () => ({ running: false }),
          applyCachedState: (cachedState) => {
            applyCachedState(cachedState);
          },
        }),
      {
        initialProps: {
          conversationId: 'conversation-1',
          state: { running: true },
        },
      }
    );

    await act(async () => {
      await Promise.resolve();
    });

    rerender({
      conversationId: 'conversation-2',
      state: { running: false },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(applyCachedState).toHaveBeenNthCalledWith(1, { running: true });
    expect(applyCachedState).toHaveBeenNthCalledWith(2, { running: false });
  });
});
