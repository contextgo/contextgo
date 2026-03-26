import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const listAvailableHooksMock = vi.fn();
const getHookPathsMock = vi.fn();
const importHookWithSymlinkMock = vi.fn();
const deleteHookMock = vi.fn();
const installBuiltinHookMock = vi.fn();
const showOpenMock = vi.fn();
const openFileMock = vi.fn();
const successMessageMock = vi.fn();
const errorMessageMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; name?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      listAvailableHooks: { invoke: (...args: unknown[]) => listAvailableHooksMock(...args) },
      getHookPaths: { invoke: (...args: unknown[]) => getHookPathsMock(...args) },
      importHookWithSymlink: { invoke: (...args: unknown[]) => importHookWithSymlinkMock(...args) },
      deleteHook: { invoke: (...args: unknown[]) => deleteHookMock(...args) },
      installBuiltinHook: { invoke: (...args: unknown[]) => installBuiltinHookMock(...args) },
    },
    dialog: {
      showOpen: { invoke: (...args: unknown[]) => showOpenMock(...args) },
    },
    shell: {
      openFile: { invoke: (...args: unknown[]) => openFileMock(...args) },
    },
  },
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='settings-page-wrapper'>{children}</div>,
}));

vi.mock('@icon-park/react', () => ({
  Delete: () => <span data-testid='icon-delete' />,
  FolderOpen: () => <span data-testid='icon-folder' />,
  Plus: () => <span data-testid='icon-plus' />,
  Search: () => <span data-testid='icon-search' />,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    icon,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    icon?: React.ReactNode;
  }) => (
    <button type='button' onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Collapse: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    Item: ({
      header,
      children,
      extra,
    }: {
      header: React.ReactNode;
      children: React.ReactNode;
      extra?: React.ReactNode;
    }) => (
      <section>
        <div>{header}</div>
        {extra}
        <div>{children}</div>
      </section>
    ),
  }),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
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
        success: successMessageMock,
        error: errorMessageMock,
      },
      <div key='message-context' />,
    ],
  },
  Modal: ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) =>
    visible ? <div>{children}</div> : null,
  Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
    Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  },
}));

import HooksManagement from '@/renderer/pages/settings/AgentSettings/HooksManagement';

describe('HooksManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAvailableHooksMock.mockResolvedValue([
      {
        name: 'prompt-guard',
        description: 'Protect prompt content',
        location: '/hooks/prompt-guard',
        isCustom: true,
        supportedBackends: ['codex'],
        events: ['before_user_prompt'],
      },
    ]);
    getHookPathsMock.mockResolvedValue({ userHooksDir: '/hooks' });
    importHookWithSymlinkMock.mockResolvedValue({ success: true });
    deleteHookMock.mockResolvedValue({ success: true });
    installBuiltinHookMock.mockResolvedValue({ success: true });
    showOpenMock.mockResolvedValue(['/tmp/new-hook']);
    openFileMock.mockResolvedValue(undefined);
  });

  it('shows only hook-library actions in the page header', async () => {
    render(<HooksManagement />);

    await waitFor(() => {
      expect(listAvailableHooksMock).toHaveBeenCalled();
    });

    expect(screen.getByText('Import Hook')).toBeInTheDocument();
    expect(screen.getByText('Open Folder')).toBeInTheDocument();
    expect(screen.queryByText('Manage Assistants')).not.toBeInTheDocument();
    expect(screen.queryByText('Refresh')).not.toBeInTheDocument();
  });

  it('imports a hook and reloads the library', async () => {
    render(<HooksManagement />);

    await waitFor(() => {
      expect(screen.getByText('prompt-guard')).toBeInTheDocument();
    });

    const initialLoadCount = listAvailableHooksMock.mock.calls.length;

    fireEvent.click(screen.getByText('Import Hook'));

    await waitFor(() => {
      expect(showOpenMock).toHaveBeenCalled();
      expect(importHookWithSymlinkMock).toHaveBeenCalledWith({ hookPath: '/tmp/new-hook' });
    });

    expect(listAvailableHooksMock.mock.calls.length).toBeGreaterThan(initialLoadCount);
  });

  it('opens the hook folder using the resolved library path', async () => {
    render(<HooksManagement />);

    await waitFor(() => {
      expect(screen.getByText('/hooks')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Open Folder'));

    await waitFor(() => {
      expect(openFileMock).toHaveBeenCalledWith('/hooks');
    });
  });
});
