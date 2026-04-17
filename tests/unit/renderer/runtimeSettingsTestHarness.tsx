import React from 'react';
import { act, cleanup, render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

export const getAvailableAgentsInvokeMock = vi.fn();
export const listExternalSessionsInvokeMock = vi.fn();
export const checkAgentHealthInvokeMock = vi.fn();
export const installManagedRuntimeInvokeMock = vi.fn();
export const getManagedRuntimeConfigLocationInvokeMock = vi.fn();
export const refreshDetectedAgentsInvokeMock = vi.fn().mockResolvedValue({ success: true });
export const openExternalInvokeMock = vi.fn().mockResolvedValue(undefined);
export const openFileInvokeMock = vi.fn().mockResolvedValue(undefined);
export const readFileInvokeMock = vi.fn();
export const writeFileInvokeMock = vi.fn().mockResolvedValue(true);
export const revealPathInvokeMock = vi
  .fn()
  .mockResolvedValue({ resolvedPath: '/Users/tester/.codex/config.toml', exists: true });
export const openFilePreviewMock = vi.fn().mockResolvedValue(true);
export const configStorageGetMock = vi.fn();
export const mutateMock = vi.fn().mockResolvedValue(undefined);
export const messageSuccessMock = vi.fn();
export const messageErrorMock = vi.fn();
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

export const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

export const renderRuntimeSettings = (): RenderResult =>
  render(
    <MemoryRouter initialEntries={['/settings/runtime']}>
      <Routes>
        <Route path='/settings/runtime' element={<AgentEntrySettings />} />
      </Routes>
    </MemoryRouter>
  );

export const cleanupRuntimeSettingsTest = async () => {
  cleanup();
  managedRuntimeInstallEventListener = null;
};

export const emitManagedRuntimeInstallEvent = (event: unknown) => {
  managedRuntimeInstallEventListener?.(event);
};

export const resetRuntimeSettingsMocks = () => {
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
};
