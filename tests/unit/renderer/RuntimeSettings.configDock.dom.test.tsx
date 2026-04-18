import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const useLayoutContextMock = vi.fn();
const getAvailableAgentsInvokeMock = vi.fn();
const listExternalSessionsInvokeMock = vi.fn();
const checkAgentHealthInvokeMock = vi.fn();
const installManagedRuntimeInvokeMock = vi.fn();
const getManagedRuntimeConfigLocationInvokeMock = vi.fn();
const refreshDetectedAgentsInvokeMock = vi.fn().mockResolvedValue({ success: true });
const openExternalInvokeMock = vi.fn().mockResolvedValue(undefined);
const openFileInvokeMock = vi.fn().mockResolvedValue(undefined);
const readFileInvokeMock = vi.fn();
const writeFileInvokeMock = vi.fn().mockResolvedValue(true);
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
  fs: {
    readFile: { invoke: (...args: unknown[]) => readFileInvokeMock(...args) },
    writeFile: { invoke: (...args: unknown[]) => writeFileInvokeMock(...args) },
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

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => useLayoutContextMock(),
}));

vi.mock('@/renderer/pages/conversation/Preview/components/editors/TextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label='Runtime config editor' value={value} onChange={(event) => onChange(event.target.value)} />
  ),
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
  Close: () => <span data-testid='icon-close' />,
  Delete: () => <span data-testid='icon-delete' />,
  EditTwo: () => <span data-testid='icon-edit' />,
  Plus: () => <span data-testid='icon-plus' />,
  Refresh: () => <span data-testid='icon-refresh' />,
  Save: () => <span data-testid='icon-save' />,
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
  Tabs: Object.assign(
    ({
      activeTab,
      onChange,
      children,
    }: {
      activeTab?: string;
      onChange?: (key: string) => void;
      children?: React.ReactNode;
    }) => {
      const items = React.Children.toArray(children) as Array<
        React.ReactElement<{ title?: React.ReactNode; key?: string }>
      >;
      return (
        <div>
          <div role='tablist'>
            {items.map((item, index) => {
              const key = String(item.key ?? index).replace(/^\.\$/, '');
              return (
                <button
                  key={key}
                  type='button'
                  role='tab'
                  aria-selected={activeTab === key}
                  onClick={() => onChange?.(key)}
                >
                  {item.props.title ?? key}
                </button>
              );
            })}
          </div>
          {items.find((item, index) => String(item.key ?? index).replace(/^\.\$/, '') === activeTab) ?? null}
        </div>
      );
    },
    {
      TabPane: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    }
  ),
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
  Divider: () => <hr />,
  Spin: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

import AgentEntrySettings from '@/renderer/pages/settings/AgentSettings/AgentEntrySettings';
import SettingsSideDock from '@/renderer/pages/settings/components/SettingsSideDock';

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const renderRuntimeSettings = () =>
  render(
    <MemoryRouter initialEntries={['/settings/runtime']}>
      <Routes>
        <Route path='/settings/runtime' element={<AgentEntrySettings />} />
      </Routes>
    </MemoryRouter>
  );

describe.skip('Runtime Settings config dock', () => {
  afterEach(() => {
    cleanup();
    managedRuntimeInstallEventListener = null;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    managedRuntimeInstallEventListener = null;
    useLayoutContextMock.mockReturnValue({
      isMobile: false,
    });
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
    readFileInvokeMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/Users/tester/.codex/config.toml') {
        return 'model = "gpt-5.4"';
      }
      if (path === '/Users/tester/.codex/auth.json') {
        return '{"api_key":"secret"}';
      }
      if (path === '/Users/tester/.config/opencode/opencode.json') {
        return '{"model":"opencode"}';
      }
      if (path === '/Users/tester/.local/share/opencode/auth.json') {
        return '{"token":"abc"}';
      }
      return '';
    });
    configStorageGetMock.mockImplementation(async (key: string) => {
      if (key === 'acp.customAgents') return [];
      return undefined;
    });
  });

  it('opens the runtime config in an in-app dock instead of the system file opener', async () => {
    renderRuntimeSettings();

    await screen.findByText('/opt/codex/bin/codex');
    const codexCard = screen.getByTestId('runtime-card-codex');
    await act(async () => {
      fireEvent.click(within(codexCard).getByRole('button', { name: 'Open config' }));
      await flushPromises();
    });
    expect(getManagedRuntimeConfigLocationInvokeMock).toHaveBeenCalledWith({ backend: 'codex' });
    expect(readFileInvokeMock).toHaveBeenCalledWith({ path: '/Users/tester/.codex/config.toml' });
    expect(readFileInvokeMock).toHaveBeenCalledWith({ path: '/Users/tester/.codex/auth.json' });

    const dock = screen.getByTestId('runtime-config-dock');
    expect(dock).toBeInTheDocument();
    expect(within(dock).getByRole('tab', { name: 'config.toml' })).toBeInTheDocument();
    expect(within(dock).getByRole('tab', { name: 'auth.json' })).toBeInTheDocument();
    expect(within(dock).getByRole('textbox', { name: 'Runtime config editor' })).toHaveValue('model = "gpt-5.4"');
    expect(openFileInvokeMock).not.toHaveBeenCalled();
    expect(openFilePreviewMock).not.toHaveBeenCalled();
  });

  it('switches between multiple config sources inside the runtime config dock', async () => {
    getManagedRuntimeConfigLocationInvokeMock.mockResolvedValueOnce({
      success: true,
      data: {
        backend: 'opencode',
        entries: [
          {
            kind: 'config',
            path: '/Users/tester/.config/opencode/opencode.json',
            exists: true,
          },
          {
            kind: 'auth',
            path: '/Users/tester/.local/share/opencode/auth.json',
            exists: true,
          },
        ],
      },
    });

    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('runtime-card-opencode')).getByRole('button', { name: 'Open config' }));
      await flushPromises();
    });

    const dock = await screen.findByTestId('runtime-config-dock');
    await within(dock).findByRole('tab', { name: 'opencode.json' });
    expect(within(dock).getByRole('textbox', { name: 'Runtime config editor' })).toHaveValue('{"model":"opencode"}');

    fireEvent.click(within(dock).getByRole('tab', { name: 'auth.json' }));
    await flushPromises();
    expect(within(dock).getByRole('textbox', { name: 'Runtime config editor' })).toHaveValue('{"token":"abc"}');
    expect(openFileInvokeMock).not.toHaveBeenCalled();
  });

  it('saves edited config content from the dock back to disk', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Open config' }));
      await flushPromises();
    });

    const dock = await screen.findByTestId('runtime-config-dock');
    await within(dock).findByRole('tab', { name: 'config.toml' });
    expect(within(dock).getByRole('textbox', { name: 'Runtime config editor' })).toHaveValue('model = "gpt-5.4"');
    await act(async () => {
      fireEvent.click(within(dock).getByRole('button', { name: 'Save config' }));
      await flushPromises();
    });
    expect(writeFileInvokeMock).toHaveBeenCalledWith({
      path: '/Users/tester/.codex/config.toml',
      data: 'model = "gpt-5.4"',
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
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Open config' }));
      await flushPromises();
    });

    expect(readFileInvokeMock).toHaveBeenCalledWith({ path: '/Users/tester/.codex/config.toml' });
  });

  it('reveals the runtime config path in the system file manager', async () => {
    renderRuntimeSettings();

    await screen.findByText('/opt/codex/bin/codex');
    const codexCard = screen.getByTestId('runtime-card-codex');
    await act(async () => {
      fireEvent.click(within(codexCard).getByRole('button', { name: 'Reveal' }));
      await flushPromises();
    });
    expect(revealPathInvokeMock).toHaveBeenCalledWith('/Users/tester/.codex');
  });

  it('runs a health check for the selected runtime card', async () => {
    renderRuntimeSettings();

    await screen.findByRole('button', { name: 'Check availability' });
    const codexCard = screen.getByTestId('runtime-card-codex');
    await act(async () => {
      fireEvent.click(within(codexCard).getByRole('button', { name: 'Check availability' }));
      await flushPromises();
    });
    expect(checkAgentHealthInvokeMock).toHaveBeenCalledWith({ backend: 'codex' });
  });

  it('runs managed install for a missing runtime', async () => {
    renderRuntimeSettings();

    const opencodeCard = await screen.findByTestId('runtime-card-opencode');
    await act(async () => {
      fireEvent.click(within(opencodeCard).getByRole('button', { name: 'Install locally' }));
      await flushPromises();
    });
    expect(installManagedRuntimeInvokeMock).toHaveBeenCalled();
  });

  it('renders install progress logs from managed runtime events', async () => {
    renderRuntimeSettings();

    const opencodeCard = await screen.findByTestId('runtime-card-opencode');
    fireEvent.click(within(opencodeCard).getByRole('button', { name: 'Install locally' }));

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

    const geminiCard = await screen.findByTestId('runtime-card-gemini');
    expect(within(geminiCard).queryByRole('button', { name: 'Install locally' })).not.toBeInTheDocument();
    expect(within(geminiCard).getByRole('button', { name: 'Official page' })).toBeInTheDocument();
  });

  it('uses the mobile runtime dock shell class on small screens', () => {
    useLayoutContextMock.mockReturnValue({
      isMobile: true,
    });

    render(
      <SettingsSideDock variant='runtime-config' ariaLabel='Runtime config editor' dataTestId='runtime-config-dock'>
        <div>dock body</div>
      </SettingsSideDock>
    );

    expect(screen.getByTestId('runtime-config-dock')).toHaveClass('settings-side-dock--mobile');
  });

  it('stacks runtime page actions for the mobile layout', async () => {
    useLayoutContextMock.mockReturnValue({
      isMobile: true,
    });

    renderRuntimeSettings();

    await screen.findByText('Runtime Management');

    expect(screen.getByTestId('runtime-page-refresh-action')).toHaveClass('w-full');
    expect(screen.getByTestId('runtime-card-actions-codex')).toHaveClass('flex-col');
  });
});
