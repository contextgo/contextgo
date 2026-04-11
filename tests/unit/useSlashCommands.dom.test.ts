import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getSlashCommandsInvokeMock,
  isSlashCommandListEnabledMock,
  addEventListenerMock,
  translationApi,
} = vi.hoisted(() => ({
  getSlashCommandsInvokeMock: vi.fn(),
  isSlashCommandListEnabledMock: vi.fn(() => true),
  addEventListenerMock: vi.fn(),
  translationApi: {
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en-US' },
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      getSlashCommands: {
        invoke: getSlashCommandsInvokeMock,
      },
    },
  },
}));

vi.mock('@/common/chat/slash/availability', () => ({
  isSlashCommandListEnabled: (...args: unknown[]) => isSlashCommandListEnabledMock(...args),
}));

vi.mock('@/renderer/utils/emitter', () => ({
  addEventListener: (...args: unknown[]) => addEventListenerMock(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => translationApi,
}));

import { useSlashCommands } from '@/renderer/hooks/chat/useSlashCommands';

describe('useSlashCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSlashCommandListEnabledMock.mockReturnValue(true);
    addEventListenerMock.mockImplementation(() => () => {});
  });

  it('merges runtime commands with managed commands returned by the backend', async () => {
    getSlashCommandsInvokeMock.mockResolvedValue({
      success: true,
      data: {
        commands: [{ name: 'remote-review', description: 'Remote review', kind: 'builtin', source: 'acp' }],
        managedLibrary: [
          {
            type: 'builtin',
            id: 'plan',
            enabled: true,
            nameOverride: 'workspace-plan',
          },
          {
            type: 'custom',
            id: 'workspace-triage',
            enabled: true,
            name: 'triage',
            description: 'Workspace triage',
            template: 'Use workspace triage.',
          },
        ],
      },
    });

    const { result } = renderHook(() => useSlashCommands('conv-1'));

    await waitFor(() => {
      expect(result.current.some((command) => command.name === 'remote-review')).toBe(true);
      expect(result.current.some((command) => command.name === 'workspace-plan')).toBe(true);
      expect(result.current.some((command) => command.name === 'triage')).toBe(true);
    });

    expect(getSlashCommandsInvokeMock).toHaveBeenCalledWith({
      conversation_id: 'conv-1',
      includeRuntimeCommands: true,
    });
  });

  it('skips runtime command loading when slash availability disables cache-backed runtime commands', async () => {
    isSlashCommandListEnabledMock.mockReturnValue(false);
    getSlashCommandsInvokeMock.mockResolvedValue({
      success: true,
      data: {
        commands: [{ name: 'remote-review', description: 'Remote review', kind: 'builtin', source: 'acp' }],
        managedLibrary: [
          {
            type: 'builtin',
            id: 'plan',
            enabled: true,
            nameOverride: 'workspace-plan',
          },
        ],
      },
    });

    const { result } = renderHook(() => useSlashCommands('conv-2'));

    await waitFor(() => {
      expect(result.current.some((command) => command.name === 'workspace-plan')).toBe(true);
    });

    expect(result.current.some((command) => command.name === 'remote-review')).toBe(false);
    expect(getSlashCommandsInvokeMock).toHaveBeenCalledWith({
      conversation_id: 'conv-2',
      includeRuntimeCommands: false,
    });
  });

  it('refreshes managed commands after commands library update events', async () => {
    let onLibraryUpdated: (() => void) | undefined;
    addEventListenerMock.mockImplementation((eventName: string, listener: () => void) => {
      if (eventName === 'commands.library.updated') {
        onLibraryUpdated = listener;
      }
      return () => {};
    });
    getSlashCommandsInvokeMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          commands: [],
          managedLibrary: [{ type: 'builtin', id: 'plan', enabled: true, nameOverride: 'global-plan' }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          commands: [],
          managedLibrary: [{ type: 'builtin', id: 'plan', enabled: true, nameOverride: 'workspace-plan' }],
        },
      });

    const { result } = renderHook(() => useSlashCommands('conv-3'));

    await waitFor(() => {
      expect(result.current.some((command) => command.name === 'global-plan')).toBe(true);
    });

    act(() => {
      onLibraryUpdated?.();
    });

    await waitFor(() => {
      expect(result.current.some((command) => command.name === 'workspace-plan')).toBe(true);
    });
  });
});
