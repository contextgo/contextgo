import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAvailableAgentsInvokeMock = vi.fn();
const checkAgentHealthInvokeMock = vi.fn();
const refreshCustomAgentsInvokeMock = vi.fn().mockResolvedValue({ success: true });
const openExternalInvokeMock = vi.fn().mockResolvedValue(undefined);
const configStorageGetMock = vi.fn();
const configStorageSetMock = vi.fn().mockResolvedValue(undefined);
const mutateMock = vi.fn().mockResolvedValue(undefined);
const copyTextMock = vi.fn().mockResolvedValue(undefined);
const messageSuccessMock = vi.fn();
const messageErrorMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  acpConversation: {
    getAvailableAgents: { invoke: (...args: unknown[]) => getAvailableAgentsInvokeMock(...args) },
    checkAgentHealth: { invoke: (...args: unknown[]) => checkAgentHealthInvokeMock(...args) },
    refreshCustomAgents: { invoke: (...args: unknown[]) => refreshCustomAgentsInvokeMock(...args) },
  },
  ipcBridge: {
    shell: {
      openExternal: { invoke: (...args: unknown[]) => openExternalInvokeMock(...args) },
    },
  },
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    get: (...args: unknown[]) => configStorageGetMock(...args),
    set: (...args: unknown[]) => configStorageSetMock(...args),
  },
}));

vi.mock('swr', () => ({
  mutate: (...args: unknown[]) => mutateMock(...args),
}));

vi.mock('@/renderer/utils/ui/clipboard', () => ({
  copyText: (...args: unknown[]) => copyTextMock(...args),
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
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  },
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
    getAvailableAgentsInvokeMock.mockResolvedValue({
      success: true,
      data: [{ backend: 'codex', name: 'Codex', cliPath: '/opt/codex/bin/codex', runtimeSource: 'detected' }],
    });
    checkAgentHealthInvokeMock.mockResolvedValue({
      success: true,
      data: { available: true, latency: 123 },
    });
    configStorageGetMock.mockImplementation(async (key: string) => {
      if (key === 'acp.config') return {};
      if (key === 'codex.config') return { cliPath: '/custom/codex' };
      if (key === 'acp.customAgents') return [];
      return undefined;
    });
  });

  it('renders the dedicated runtime entry and shows runtime management content', async () => {
    renderRuntimeSettings();

    expect(await screen.findByText('Runtime Management')).toBeInTheDocument();
    expect(screen.getByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
    expect(screen.getByText('/custom/codex')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Copy Install Command' }).length).toBeGreaterThan(0);
  });

  it('runs a health check for the selected runtime card', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.click(screen.getAllByRole('button', { name: 'Check Health' })[0]);

    await waitFor(() => {
      expect(checkAgentHealthInvokeMock).toHaveBeenCalledWith({ backend: 'codex' });
    });
  });

  it('saves the overridden runtime path for codex', async () => {
    renderRuntimeSettings();

    await screen.findByText('Runtime Management');
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: '/new/codex/path' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Path' })[0]);

    await waitFor(() => {
      expect(configStorageSetMock).toHaveBeenCalledWith('codex.config', {
        cliPath: '/new/codex/path',
      });
    });
  });
});
