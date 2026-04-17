import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addOrUpdateMessageMock = vi.fn();
const mockGetConversation = vi.fn().mockResolvedValue(null);

let capturedResponseListener: ((message: unknown) => void) | null = null;

vi.mock('@/common', () => ({
  ipcBridge: {
    acpConversation: {
      responseStream: {
        on: vi.fn((listener: (message: unknown) => void) => {
          capturedResponseListener = listener;
          return () => {
            capturedResponseListener = null;
          };
        }),
      },
    },
    conversation: {
      get: { invoke: (...args: unknown[]) => mockGetConversation(...args) },
    },
  },
}));

vi.mock('@/common/chat/chatLib', () => ({
  shouldSuppressAgentLifecycleStreamMessage: vi.fn(() => false),
  transformMessage: vi.fn((message: unknown) => message),
}));

vi.mock('@/renderer/pages/conversation/Messages/hooks', () => ({
  useAddOrUpdateMessage: vi.fn(() => addOrUpdateMessageMock),
}));

import { useAcpMessage } from '@/renderer/pages/conversation/platforms/acp/useAcpMessage';

const CONVERSATION_ID = 'acp-conversation-1';

describe('useAcpMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    capturedResponseListener = null;
    addOrUpdateMessageMock.mockReset();
    mockGetConversation.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('stores streamed plan entries for the current run and clears them on finish', async () => {
    const { result } = renderHook(() => useAcpMessage(CONVERSATION_ID));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.beginRun('整理 session memory');
    });

    act(() => {
      capturedResponseListener?.({
        type: 'plan',
        msg_id: 'plan-1',
        conversation_id: CONVERSATION_ID,
        data: {
          entries: [
            { content: '收集当前会话线索', status: 'completed' },
            { content: '提炼运行时计划', status: 'in_progress' },
          ],
        },
      });
    });

    expect(result.current.runtimePlanEntries).toEqual([
      { content: '收集当前会话线索', status: 'completed' },
      { content: '提炼运行时计划', status: 'in_progress' },
    ]);
    expect(result.current.runTrace?.planEntries).toEqual(result.current.runtimePlanEntries);
    expect(addOrUpdateMessageMock).toHaveBeenCalledTimes(1);

    act(() => {
      capturedResponseListener?.({
        type: 'finish',
        msg_id: 'finish-1',
        conversation_id: CONVERSATION_ID,
        data: null,
      });
    });

    expect(result.current.runtimePlanEntries).toEqual([]);
  });

  it('overwrites live thought text with the latest streamed thought instead of accumulating chunks', async () => {
    const { result } = renderHook(() => useAcpMessage(CONVERSATION_ID));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.beginRun('整理 runtime 详情卡片');
    });

    act(() => {
      capturedResponseListener?.({
        type: 'thought',
        msg_id: 'thought-1',
        conversation_id: CONVERSATION_ID,
        data: {
          subject: '第一版思路',
          description: '第一版思路：先收集上下文。',
        },
      });
    });

    expect(result.current.thought.description).toBe('第一版思路：先收集上下文。');
    expect(result.current.runTrace?.liveThoughtText).toBe('第一版思路：先收集上下文。');

    act(() => {
      capturedResponseListener?.({
        type: 'thought',
        msg_id: 'thought-2',
        conversation_id: CONVERSATION_ID,
        data: {
          subject: '第二版思路',
          description: '第二版思路：直接覆盖当前展示，不累计旧文本。',
        },
      });
      vi.runAllTimers();
    });

    expect(result.current.thought.description).toBe('第二版思路：直接覆盖当前展示，不累计旧文本。');
    expect(result.current.runTrace?.liveThoughtText).toBe('第二版思路：直接覆盖当前展示，不累计旧文本。');
    expect(result.current.runTrace?.liveThoughtText).not.toContain('第一版思路');
  });

  it('ignores plan events from other conversations and drops stale plan data on reset paths', async () => {
    const { result } = renderHook(() => useAcpMessage(CONVERSATION_ID));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.beginRun('迁移 project scoped sessions');
    });

    act(() => {
      capturedResponseListener?.({
        type: 'plan',
        msg_id: 'plan-other',
        conversation_id: 'another-conversation',
        data: {
          entries: [{ content: '不应进入当前会话', status: 'in_progress' }],
        },
      });
    });

    expect(result.current.runtimePlanEntries).toEqual([]);

    act(() => {
      capturedResponseListener?.({
        type: 'plan',
        msg_id: 'plan-2',
        conversation_id: CONVERSATION_ID,
        data: {
          entries: [{ content: '重写 vault layout policy', status: 'in_progress' }],
        },
      });
    });

    expect(result.current.runtimePlanEntries).toEqual([{ content: '重写 vault layout policy', status: 'in_progress' }]);

    act(() => {
      capturedResponseListener?.({
        type: 'agent_status',
        msg_id: 'status-1',
        conversation_id: CONVERSATION_ID,
        data: { status: 'disconnected' },
      });
    });

    expect(result.current.runtimePlanEntries).toEqual([]);

    act(() => {
      result.current.beginRun('再次执行同步');
      capturedResponseListener?.({
        type: 'plan',
        msg_id: 'plan-3',
        conversation_id: CONVERSATION_ID,
        data: {
          entries: [{ content: '重新收敛 plan', status: 'pending' }],
        },
      });
    });

    expect(result.current.runtimePlanEntries).toEqual([{ content: '重新收敛 plan', status: 'pending' }]);

    act(() => {
      result.current.resetState();
    });

    expect(result.current.runtimePlanEntries).toEqual([]);
  });

  it('restores cached running state immediately when remounting the same conversation', async () => {
    mockGetConversation.mockImplementation(
      () =>
        new Promise(() => {
          // Keep backend status unresolved so the hook must rely on the in-memory snapshot first.
        })
    );

    const first = renderHook(() => useAcpMessage(CONVERSATION_ID));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      first.result.current.beginRun('恢复运行态');
    });

    expect(first.result.current.running).toBe(false);

    act(() => {
      capturedResponseListener?.({
        type: 'start',
        msg_id: 'start-restore',
        conversation_id: CONVERSATION_ID,
        data: null,
      });
    });

    expect(first.result.current.running).toBe(true);

    first.unmount();

    const second = renderHook(() => useAcpMessage(CONVERSATION_ID));

    expect(second.result.current.running).toBe(true);
  });

  it('does not expose handshake-only agent_status transitions as a running turn', async () => {
    const { result } = renderHook(() => useAcpMessage(CONVERSATION_ID));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.running).toBe(false);

    act(() => {
      capturedResponseListener?.({
        type: 'agent_status',
        msg_id: 'status-connecting',
        conversation_id: CONVERSATION_ID,
        data: {
          status: 'connecting',
        },
      });
    });

    expect(result.current.running).toBe(false);
    expect(result.current.acpStatus).toBe('connecting');

    act(() => {
      capturedResponseListener?.({
        type: 'agent_status',
        msg_id: 'status-session-active',
        conversation_id: CONVERSATION_ID,
        data: {
          status: 'session_active',
        },
      });
    });

    expect(result.current.running).toBe(false);
    expect(result.current.acpStatus).toBe('session_active');
  });

  it('keeps the turn running when session handshake updates arrive after the run has started', async () => {
    const { result } = renderHook(() => useAcpMessage(CONVERSATION_ID));

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.beginRun('send ACP message');
      result.current.setAiProcessing(true);
      capturedResponseListener?.({
        type: 'start',
        msg_id: 'start-1',
        conversation_id: CONVERSATION_ID,
        data: null,
      });
    });

    expect(result.current.running).toBe(true);

    act(() => {
      capturedResponseListener?.({
        type: 'agent_status',
        msg_id: 'status-authenticated',
        conversation_id: CONVERSATION_ID,
        data: {
          status: 'authenticated',
        },
      });
    });

    expect(result.current.running).toBe(true);
    expect(result.current.aiProcessing).toBe(true);
    expect(result.current.acpStatus).toBe('authenticated');
  });
});
