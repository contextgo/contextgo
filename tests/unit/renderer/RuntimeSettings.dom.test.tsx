import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAvailableAgentsInvokeMock = vi.fn();
const listExternalSessionsInvokeMock = vi.fn();
const checkAgentHealthInvokeMock = vi.fn();
const installManagedRuntimeInvokeMock = vi.fn();
const getManagedRuntimeConfigLocationInvokeMock = vi.fn();
const refreshDetectedAgentsInvokeMock = vi.fn().mockResolvedValue({ success: true });
const openExternalInvokeMock = vi.fn().mockResolvedValue(undefined);
const openFileInvokeMock = vi.fn().mockResolvedValue(undefined);
const revealPathInvokeMock = vi
  .fn()
  .mockResolvedValue({ resolvedPath: '/Users/tester/.codex/config.toml', exists: true });
const openFilePreviewMock = vi.fn().mockResolvedValue(true);
const configStorageGetMock = vi.fn();
const mutateMock = vi.fn().mockResolvedValue(undefined);
const messageSuccessMock = vi.fn();
const messageErrorMock = vi.fn();
let managedRuntimeInstallEventListener: ((event: unknown) => void) | null = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  acpConversation: {
    getAvailableAgents: { invoke: (...args: unknown[]) => getAvailableAgentsInvokeMock(...args) },
    listExternalSessions: { invoke: (...args: unknown[]) => listExternalSessionsInvokeMock(...args) },
    checkAgentHealth: { invoke: (...args: unknown[]) => checkAgentHealthInvokeMock(...args) },
    installManagedRuntime: { invoke: (...args: unknown[]) => installManagedRuntimeInvokeMock(...args) },
    getManagedRuntimeConfigLocation: {
      invoke: (...args: unknown[]) => getManagedRuntimeConfigLocationInvokeMock(...args),
    },
    refreshDetectedAgents: { invoke: (...args: unknown[]) => refreshDetectedAgentsInvokeMock(...args) },
    managedRuntimeInstallEvent: {
      on: (listener: (event: unknown) => void) => {
        managedRuntimeInstallEventListener = listener;
        return () => {
          managedRuntimeInstallEventListener = null;
        };
      },
    },
  },
  shell: {
    openExternal: { invoke: (...args: unknown[]) => openExternalInvokeMock(...args) },
    openFile: { invoke: (...args: unknown[]) => openFileInvokeMock(...args) },
    revealPath: { invoke: (...args: unknown[]) => revealPathInvokeMock(...args) },
  },
}));

vi.mock('@/renderer/hooks/file/useFilePreviewOpener', () => ({
  useFilePreviewOpener: () => ({
    openFilePreview: (...args: unknown[]) => openFilePreviewMock(...args),
    loading: false,
  }),
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    get: (...args: unknown[]) => configStorageGetMock(...args),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('swr', () => ({
  mutate: (...args: unknown[]) => mutateMock(...args),
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='settings-page-wrapper'>{children}</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/channels/ChannelModalContent', () => ({
  default: () => <div data-testid='channel-modal-content' />,
}));

vi.mock('@/renderer/components/base/ContextGoModal', () => ({
  default: ({
    visible,
    children,
    onOk,
    onCancel,
  }: {
    visible?: boolean;
    children?: React.ReactNode;
    onOk?: () => void;
    onCancel?: () => void;
  }) =>
    visible ? (
      <div>
        <div>{children}</div>
        <button type='button' onClick={onOk}>
          OK
        </button>
        <button type='button' onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}));

vi.mock('@/renderer/pages/settings/AgentSettings/CustomAcpAgentModal', () => ({
  default: () => null,
}));

vi.mock('@/renderer/utils/model/agentLogo', () => ({
  getAgentLogo: () => '/logo.svg',
}));

vi.mock('@icon-park/react', () => ({
  Delete: () => <span data-testid='icon-delete' />,
  EditTwo: () => <span data-testid='icon-edit' />,
  Plus: () => <span data-testid='icon-plus' />,
}));

vi.mock('@arco-design/web-react', () => ({
  Alert: ({ content }: { content?: React.ReactNode }) => <div>{content}</div>,
  Button: ({
    children,
    onClick,
    loading,
    icon,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    loading?: boolean;
    icon?: React.ReactNode;
  }) => (
    <button type='button' onClick={onClick} disabled={loading}>
      {icon}
      {children}
    </button>
  ),
  Collapse: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Item: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => (
      <section>
        <div>{header}</div>
        <div>{children}</div>
      </section>
    ),
  }),
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
  }) => <input value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />,
  Message: {
    useMessage: () => [
      {
        success: (...args: unknown[]) => messageSuccessMock(...args),
        error: (...args: unknown[]) => messageErrorMock(...args),
      },
      <div key='message-context' />,
    ],
  },
  Space: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

import AgentEntrySettings from '@/renderer/pages/settings/AgentSettings/AgentEntrySettings';

const renderRuntimeSettings = () =>
  render(
    <MemoryRouter initialEntries={['/settings/runtime']}>
      <Routes>
        <Route path='/settings/runtime' element={<AgentEntrySettings />} />
      </Routes>
    </MemoryRouter>
  );

describe('Runtime Settings page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managedRuntimeInstallEventListener = null;
    getAvailableAgentsInvokeMock.mockResolvedValue({
      success: true,
      data: [
        {
          backend: 'codex',
          name: 'Codex',
          cliPath: '/opt/codex/bin/codex',
          resolvedCliPath: '/opt/codex/bin/codex',
          runtimeSource: 'detected',
        },
      ],
    });
    listExternalSessionsInvokeMock.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          { provider: 'codex', sessionId: 'session-1', title: 'Resume me', workspace: '/tmp/project', updatedAt: 1 },
        ],
      },
    });
    checkAgentHealthInvokeMock.mockResolvedValue({
      success: true,
      data: { available: true, latency: 123 },
    });
    installManagedRuntimeInvokeMock.mockResolvedValue({
      success: true,
      data: { backend: 'codex', command: 'npm install -g @openai/codex' },
    });
    getManagedRuntimeConfigLocationInvokeMock.mockResolvedValue({
      success: true,
      data: {
        backend: 'codex',
        entries: [
          {
            kind: 'config',
            path: '/Users/tester/.codex/config.toml',
            exists: true,
          },
          {
            kind: 'auth',
            path: '/Users/tester/.codex/auth.json',
            exists: true,
          },
        ],
      },
    });
    configStorageGetMock.mockImplementation(async (key: string) => {
      if (key === 'acp.customAgents') return [];
      return undefined;
    });
  });

  it('renders the dedicated runtime entry and shows the simplified runtime management content', async () => {
    renderRuntimeSettings();

    expect(await screen.findByText('Runtime Management')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByTestId('runtime-card-claude')).toBeInTheDocument();
    expect(screen.getByTestId('runtime-card-opencode')).toBeInTheDocument();
    expect(screen.queryByTestId('runtime-card-openclaw-gateway')).not.toBeInTheDocument();
    expect(screen.queryByTestId('runtime-card-nanobot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('runtime-card-qwen')).not.toBeInTheDocument();
    expect(screen.queryByTestId('runtime-card-auggie')).not.toBeInTheDocument();

    const codexCard = screen.getByTestId('runtime-card-codex');
    expect(within(codexCard).getByText('/opt/codex/bin/codex')).toBeInTheDocument();
    expect(within(codexCard).getByText('Takeover sessions 1')).toBeInTheDocument();
    expect(within(codexCard).getByRole('button', { name: 'Open config' })).toBeInTheDocument();
    expect(within(codexCard).getByRole('button', { name: 'Reveal' })).toBeInTheDocument();
  });

  it('does not render the removed custom runtime section', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    expect(screen.queryByText('Custom Runtime Adapters')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom runtimes')).not.toBeInTheDocument();
  });

  it('hides install actions for a detected runtime and keeps login actions available', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    const codexCard = screen.getByTestId('runtime-card-codex');

    expect(within(codexCard).queryByRole('button', { name: 'Install locally' })).not.toBeInTheDocument();
    expect(within(codexCard).queryByText('Needs Login')).not.toBeInTheDocument();
  });

  it('hides availability checks for missing runtimes', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    const claudeCard = screen.getByTestId('runtime-card-claude');
    expect(within(claudeCard).queryByRole('button', { name: 'Check availability' })).not.toBeInTheDocument();
    expect(within(claudeCard).getByRole('button', { name: 'Open config' })).toBeInTheDocument();
    expect(within(claudeCard).getByRole('button', { name: 'Reveal' })).toBeInTheDocument();
    expect(within(claudeCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
    expect(within(claudeCard).queryByText('No path is being used yet.')).not.toBeInTheDocument();

    const opencodeCard = screen.getByTestId('runtime-card-opencode');
    expect(within(opencodeCard).queryByRole('button', { name: 'Check availability' })).not.toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Install locally' })).toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
    expect(within(opencodeCard).queryByText('No path is being used yet.')).not.toBeInTheDocument();
  });

  it('shows docs for missing runtimes and keeps install entry when managed install is supported', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    const opencodeCard = screen.getByTestId('runtime-card-opencode');

    expect(within(opencodeCard).getByRole('button', { name: 'Install locally' })).toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
  });

  it('opens the official docs for the selected runtime', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(within(screen.getByTestId('runtime-card-opencode')).getByRole('button', { name: 'Official page' }));

    await waitFor(() => {
      expect(openExternalInvokeMock).toHaveBeenCalledWith('https://opencode.ai');
    });
  });

  it('opens the runtime config in the shared preview panel', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Open config' }));

    await waitFor(() => {
      expect(getManagedRuntimeConfigLocationInvokeMock).toHaveBeenCalledWith({ backend: 'codex' });
      expect(openFilePreviewMock).toHaveBeenCalledWith({ path: '/Users/tester/.codex/config.toml' });
      expect(openFilePreviewMock).toHaveBeenCalledWith({ path: '/Users/tester/.codex/auth.json' });
    });

    expect(openFilePreviewMock).toHaveBeenCalledTimes(2);
    expect(openFileInvokeMock).not.toHaveBeenCalled();
  });

  it('falls back to the system opener when config preview cannot be mounted', async () => {
    openFilePreviewMock.mockResolvedValue(false);
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Open config' }));

    await waitFor(() => {
      expect(openFileInvokeMock).toHaveBeenCalledWith('/Users/tester/.codex/config.toml');
      expect(openFileInvokeMock).toHaveBeenCalledWith('/Users/tester/.codex/auth.json');
    });

    expect(openFileInvokeMock).toHaveBeenCalledTimes(2);
  });

  it('reveals the runtime config path in the system file manager', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Reveal' }));

    await waitFor(() => {
      expect(revealPathInvokeMock).toHaveBeenCalledWith('/Users/tester/.codex');
    });
  });

  it('keeps opening config working when the runtime bridge still returns the legacy single-path payload', async () => {
    getManagedRuntimeConfigLocationInvokeMock.mockResolvedValueOnce({
      success: true,
      data: {
        backend: 'codex',
        configPath: '/Users/tester/.codex/config.toml',
        exists: true,
      },
    });

    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Open config' }));

    await waitFor(() => {
      expect(openFilePreviewMock).toHaveBeenCalledWith({ path: '/Users/tester/.codex/config.toml' });
    });
  });

  it('runs a health check for the selected runtime card', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(screen.getAllByRole('button', { name: 'Check availability' })[0]);

    await waitFor(() => {
      expect(checkAgentHealthInvokeMock).toHaveBeenCalledWith({ backend: 'codex' });
    });
  });

  it('runs managed install for a missing runtime', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(screen.getAllByRole('button', { name: 'Install locally' })[0]);

    await waitFor(() => {
      expect(installManagedRuntimeInvokeMock).toHaveBeenCalled();
    });
  });

  it('renders install progress logs from managed runtime events', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(screen.getAllByRole('button', { name: 'Install locally' })[0]);

    expect(managedRuntimeInstallEventListener).toBeTruthy();

    managedRuntimeInstallEventListener?.({
      backend: 'opencode',
      command: 'npm install -g @opencode-ai/cli',
      stage: 'running',
      chunk: 'downloading package\n',
    });

    managedRuntimeInstallEventListener?.({
      backend: 'opencode',
      command: 'npm install -g @opencode-ai/cli',
      stage: 'refreshing',
      message: 'Refreshing runtime detection for opencode',
    });

    await screen.findByText('Install progress');
    expect(screen.getByText('Refreshing runtime detection for opencode')).toBeInTheDocument();
    expect(screen.getByText(/downloading package/i)).toBeInTheDocument();
  });

  it('does not show install action for unmanaged runtimes', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    const geminiCard = screen.getByTestId('runtime-card-gemini');
    expect(within(geminiCard).queryByRole('button', { name: 'Install locally' })).not.toBeInTheDocument();
    expect(within(geminiCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
  });
});
