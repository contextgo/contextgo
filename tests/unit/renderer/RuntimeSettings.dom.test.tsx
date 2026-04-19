import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/renderer/pages/conversation/Preview/components/editors/TextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label='Runtime config editor' value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock('@/renderer/pages/settings/components/RuntimeConfigDock', () => ({
  default: ({
    runtimeName,
    entries,
    onClose,
  }: {
    runtimeName: string;
    entries: Array<{ path: string; kind: string; exists: boolean }>;
    onClose: () => void;
  }) => {
    const [activePath, setActivePath] = React.useState(entries[0]?.path ?? '');
    const [contentByPath, setContentByPath] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
      let cancelled = false;

      setActivePath(entries[0]?.path ?? '');
      setContentByPath({});

      void Promise.all(
        entries.map(
          async (entry) => [entry.path, entry.exists ? await readFileInvokeMock({ path: entry.path }) : ''] as const
        )
      ).then((pairs) => {
        if (cancelled) {
          return;
        }

        setContentByPath(Object.fromEntries(pairs));
      });

      return () => {
        cancelled = true;
      };
    }, [entries]);

    const activeEntry = entries.find((entry) => entry.path === activePath) ?? entries[0];
    const activeValue = activeEntry ? (contentByPath[activeEntry.path] ?? '') : '';

    return (
      <div data-testid='runtime-config-dock'>
        <div>{runtimeName}</div>
        <div role='tablist'>
          {entries.map((entry) => {
            const fileName = entry.path.split(/[\\/]/).pop() ?? entry.path;
            return (
              <button key={entry.path} type='button' role='tab' onClick={() => setActivePath(entry.path)}>
                {fileName}
              </button>
            );
          })}
        </div>
        <textarea
          aria-label='Runtime config editor'
          value={activeValue}
          onChange={(event) => {
            if (!activeEntry) {
              return;
            }

            const nextValue = event.target.value;
            setContentByPath((current) => ({
              ...current,
              [activeEntry.path]: nextValue,
            }));
          }}
        />
        <button
          type='button'
          onClick={() => {
            if (!activeEntry) {
              return;
            }

            void writeFileInvokeMock({
              path: activeEntry.path,
              data: contentByPath[activeEntry.path] ?? '',
            });
          }}
        >
          Save config
        </button>
        <button type='button' onClick={onClose}>
          Close
        </button>
      </div>
    );
  },
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

describe('Runtime Settings page', () => {
  afterEach(async () => {
    await act(async () => {
      await flushPromises();
    });
  });

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
    expect(within(opencodeCard).getByRole('button', { name: 'Open config' })).toBeInTheDocument();
    expect(within(opencodeCard).getByRole('button', { name: 'Reveal' })).toBeInTheDocument();
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

  it('opens the runtime config in an in-app dock instead of the system file opener', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Open config' }));
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

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(within(screen.getByTestId('runtime-card-codex')).getByRole('button', { name: 'Reveal' }));
      await flushPromises();
    });
    expect(revealPathInvokeMock).toHaveBeenCalledWith('/Users/tester/.codex');
  });

  it('runs a health check for the selected runtime card', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Check availability' })[0]);
      await flushPromises();
    });
    expect(checkAgentHealthInvokeMock).toHaveBeenCalledWith({ backend: 'codex' });
  });

  it('runs managed install for a missing runtime', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Install locally' })[0]);
      await flushPromises();
    });
    expect(installManagedRuntimeInvokeMock).toHaveBeenCalled();
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
