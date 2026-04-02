import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const listAvailableHooksMock = vi.fn();
const getHookPathsMock = vi.fn();
const importHookWithSymlinkMock = vi.fn();
const deleteHookMock = vi.fn();
const installBuiltinHookMock = vi.fn();
const updateHookManifestMock = vi.fn();
const showOpenMock = vi.fn();
const openFileMock = vi.fn();
const showItemInFolderMock = vi.fn();
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
      updateHookManifest: { invoke: (...args: unknown[]) => updateHookManifestMock(...args) },
    },
    dialog: {
      showOpen: { invoke: (...args: unknown[]) => showOpenMock(...args) },
    },
    shell: {
      openFile: { invoke: (...args: unknown[]) => openFileMock(...args) },
      showItemInFolder: { invoke: (...args: unknown[]) => showItemInFolderMock(...args) },
    },
  },
}));

vi.mock('@/renderer/components/base', () => ({
  ContextGoModal: ({
    visible,
    header,
    footer,
    children,
  }: {
    visible?: boolean;
    header?: React.ReactNode | { title?: React.ReactNode };
    footer?: React.ReactNode | { render?: () => React.ReactNode };
    children?: React.ReactNode;
  }) => {
    if (!visible) {
      return null;
    }

    const headerTitle = typeof header === 'object' && header !== null && 'title' in header ? header.title : header;
    const footerNode = typeof footer === 'object' && footer !== null && 'render' in footer ? footer.render?.() : footer;

    return (
      <div data-testid='mock-contextgo-modal'>
        <div>{headerTitle}</div>
        <div>{children}</div>
        <div>{footerNode}</div>
      </div>
    );
  },
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='settings-page-wrapper'>{children}</div>,
}));

vi.mock('@/renderer/components/chat/EmojiPicker', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/chat/CollapsibleContent', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/hooks/context/ThemeContext', () => ({
  useThemeContext: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    colorScheme: 'default',
    setColorScheme: vi.fn(),
    fontScale: 1,
    setFontScale: vi.fn(),
  }),
}));

vi.mock('@office-ai/platform', () => ({
  theme: {
    Color: {
      FunctionalColor: {
        success: '#00aa00',
        warn: '#ffaa00',
        error: '#cc0000',
      },
    },
  },
}));

vi.mock('@icon-park/react', () => ({
  Delete: () => <span data-testid='icon-delete' />,
  FolderOpen: () => <span data-testid='icon-folder' />,
  Plus: () => <span data-testid='icon-plus' />,
  Refresh: () => <span data-testid='icon-refresh' />,
  Close: () => <span data-testid='icon-close' />,
  Robot: () => <span data-testid='icon-robot' />,
  Search: () => <span data-testid='icon-search' />,
  CheckOne: () => <span data-testid='icon-check' />,
  Attention: () => <span data-testid='icon-attention' />,
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
  Checkbox: ({
    children,
    checked,
    onChange,
  }: {
    children?: React.ReactNode;
    checked?: boolean;
    onChange?: (value: boolean) => void;
  }) => (
    <label>
      <input type='checkbox' checked={checked} onChange={() => onChange?.(!checked)} />
      {children}
    </label>
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
  Input: Object.assign(
    ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      placeholder?: string;
    }) => <input value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />,
    {
      TextArea: ({
        value,
        onChange,
        placeholder,
      }: {
        value?: string;
        onChange?: (value: string) => void;
        placeholder?: string;
      }) => <textarea value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />,
    }
  ),
  Avatar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Drawer: ({
    visible,
    title,
    children,
    footer,
  }: {
    visible?: boolean;
    title?: React.ReactNode;
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    visible ? (
      <div>
        <div>{title}</div>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
  Message: {
    useMessage: () => [
      {
        success: successMessageMock,
        error: errorMessageMock,
      },
      <div key='message-context' />,
    ],
    error: (...args: unknown[]) => errorMessageMock(...args),
    success: (...args: unknown[]) => successMessageMock(...args),
  },
  Modal: Object.assign(
    ({
      visible,
      title,
      children,
      onOk,
      onCancel,
    }: {
      visible?: boolean;
      title?: React.ReactNode;
      children?: React.ReactNode;
      onOk?: () => void;
      onCancel?: () => void;
    }) =>
      visible ? (
        <div>
          <div>{title}</div>
          <div>{children}</div>
          <button type='button' onClick={onOk}>
            OK
          </button>
          <button type='button' onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null,
    {
      error: vi.fn(),
    }
  ),
  Select: Object.assign(
    ({
      value,
      onChange,
      children,
    }: {
      value?: string;
      onChange?: (value: string) => void;
      children?: React.ReactNode;
    }) => (
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {children}
      </select>
    ),
    {
      Option: ({ value, children }: { value: string; children?: React.ReactNode }) => (
        <option value={value}>{children}</option>
      ),
    }
  ),
  Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
    Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  },
}));

import HooksManagement from '@/renderer/pages/settings/AgentSettings/HooksManagement';
import AssistantEditDrawer from '@/renderer/pages/settings/AgentSettings/AssistantManagement/AssistantEditDrawer';
import MessageTips from '@/renderer/pages/conversation/Messages/components/MessageTips';

describe('HooksManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAvailableHooksMock.mockResolvedValue([
      {
        name: 'prompt-guard',
        description: 'Protect prompt content',
        category: 'safety',
        tags: ['security', 'pre-tool-use'],
        location: '/hooks/prompt-guard',
        isCustom: true,
        supportedBackends: ['codex'],
        executionType: 'native-projection',
        events: ['after_response'],
        runnableEvents: ['after_response'],
        outputTargets: ['system-notification', 'sidecar-file'],
        notification: {
          title: '{{conversationName}} complete',
          body: '{{finalResponseExcerpt}}',
        },
        outputFile: {
          baseDir: 'system-workdir',
          relativeDir: 'hook-outputs/{{conversationId}}/{{hookName}}',
          fileBaseName: 'latest',
        },
      },
      {
        name: 'secret-guard',
        description: 'Builtin secret scan before send',
        category: 'safety',
        tags: ['builtin'],
        location: '/builtin/hooks/secret-guard',
        isCustom: false,
        supportedBackends: ['codex'],
        executionType: 'prompt-transform',
        events: ['before_user_prompt'],
        runnableEvents: ['before_user_prompt'],
      },
      {
        name: 'continuity-handoff',
        description: 'Builtin handoff continuity helper',
        category: 'continuity',
        tags: ['builtin'],
        location: '/builtin/hooks/continuity-handoff',
        isCustom: false,
        supportedBackends: ['codex'],
        executionType: 'native-projection',
        events: ['after_response'],
        runnableEvents: ['after_response'],
      },
    ]);
    getHookPathsMock.mockResolvedValue({ userHooksDir: '/hooks' });
    importHookWithSymlinkMock.mockResolvedValue({ success: true });
    deleteHookMock.mockResolvedValue({ success: true });
    installBuiltinHookMock.mockResolvedValue({ success: true });
    updateHookManifestMock.mockResolvedValue({ success: true });
    showOpenMock.mockResolvedValue(['/tmp/new-hook']);
    openFileMock.mockResolvedValue(undefined);
    showItemInFolderMock.mockResolvedValue(undefined);
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

  it('shows hook metadata for category, tags, output routing, and runtime readiness', async () => {
    render(<HooksManagement />);

    await waitFor(() => {
      expect(screen.getByText('prompt-guard')).toBeInTheDocument();
    });

    expect(screen.getAllByText('safety').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ready Now').length).toBeGreaterThan(0);
    expect(screen.getByText('security')).toBeInTheDocument();
    expect(screen.getByText('pre-tool-use')).toBeInTheDocument();
    expect(screen.getByText(/Routes To/)).toBeInTheDocument();
    expect(screen.getByText('Desktop Notification')).toBeInTheDocument();
    expect(screen.getByText('Sidecar File')).toBeInTheDocument();
    expect(screen.getByText('Configure')).toBeInTheDocument();
  });

  it('updates hook routing configuration from the library page', async () => {
    render(<HooksManagement />);

    await waitFor(() => {
      expect(screen.getByText('prompt-guard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Configure'));

    fireEvent.change(screen.getByPlaceholderText('hook-outputs/{{conversationId}}/{{hookName}}'), {
      target: { value: 'handoff/{{conversationId}}' },
    });

    fireEvent.click(screen.getAllByText('Save')[0]);

    await waitFor(() => {
      expect(updateHookManifestMock).toHaveBeenCalledWith({
        hookName: 'prompt-guard',
        config: expect.objectContaining({
          outputTargets: ['system-notification', 'sidecar-file'],
          outputFile: expect.objectContaining({
            baseDir: 'system-workdir',
            relativeDir: 'handoff/{{conversationId}}',
            fileBaseName: 'latest',
          }),
        }),
      });
    });
  });

  it('filters builtin hooks by category tag', async () => {
    render(<HooksManagement />);

    await waitFor(() => {
      expect(screen.getByText('secret-guard')).toBeInTheDocument();
      expect(screen.getByText('continuity-handoff')).toBeInTheDocument();
    });

    const safetyFilterButton = screen
      .getAllByText('safety')
      .find((element) => element.tagName.toLowerCase() === 'button');
    expect(safetyFilterButton).toBeDefined();
    fireEvent.click(safetyFilterButton!);

    await waitFor(() => {
      expect(screen.getByText('secret-guard')).toBeInTheDocument();
      expect(screen.queryByText('continuity-handoff')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('All'));

    await waitFor(() => {
      expect(screen.getByText('continuity-handoff')).toBeInTheDocument();
    });
  });
});

describe('AssistantEditDrawer hook routing', () => {
  const hook = {
    name: 'continuity-handoff',
    description: 'Export a handoff artifact after the agent finishes.',
    category: 'continuity',
    location: '/hooks/continuity-handoff',
    isCustom: true,
    executionType: 'native-projection' as const,
    events: ['after_response' as const],
    runnableEvents: ['after_response' as const],
    outputTargets: ['sidecar-file' as const],
    outputFile: {
      baseDir: 'system-workdir' as const,
      relativeDir: 'hook-outputs/{{conversationId}}/{{hookName}}',
      fileBaseName: 'latest',
    },
  };

  it('opens the shared routing modal from the assistant hook picker and saves changes', async () => {
    const handleRefreshHooksMock = vi.fn().mockResolvedValue([hook]);

    render(
      <AssistantEditDrawer
        editVisible={true}
        setEditVisible={vi.fn()}
        isCreating={true}
        editName='Assistant'
        setEditName={vi.fn()}
        editDescription=''
        setEditDescription={vi.fn()}
        editAvatar='🤖'
        setEditAvatar={vi.fn()}
        editAvatarImage={undefined}
        editAgent='codex'
        setEditAgent={vi.fn()}
        editContext=''
        setEditContext={vi.fn()}
        promptViewMode='edit'
        setPromptViewMode={vi.fn()}
        availableSkills={[]}
        availableHooks={[hook]}
        selectedSkills={[]}
        setSelectedSkills={vi.fn()}
        selectedHooks={[hook.name]}
        setSelectedHooks={vi.fn()}
        hooksLoading={false}
        hooksDir='/hooks'
        handleRefreshHooks={handleRefreshHooksMock}
        handleImportHook={vi.fn().mockResolvedValue(undefined)}
        handleOpenHooksDir={vi.fn().mockResolvedValue(undefined)}
        deleteHookName={null}
        setDeleteHookName={vi.fn()}
        handleDeleteHookConfirm={vi.fn().mockResolvedValue(undefined)}
        pendingSkills={[]}
        customSkills={[]}
        setDeletePendingSkillName={vi.fn()}
        setDeleteCustomSkillName={vi.fn()}
        setSkillsModalVisible={vi.fn()}
        activeAssistant={null}
        activeAssistantId={null}
        isReadonlyAssistant={false}
        isExtensionAssistant={() => false}
        availableBackends={new Set(['codex'])}
        extensionAcpAdapters={[]}
        handleSave={vi.fn()}
        handleDeleteClick={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Configure'));

    fireEvent.change(screen.getByPlaceholderText('hook-outputs/{{conversationId}}/{{hookName}}'), {
      target: { value: 'handoff/{{conversationId}}' },
    });

    fireEvent.click(screen.getAllByText('Save')[0]);

    await waitFor(() => {
      expect(updateHookManifestMock).toHaveBeenCalledWith({
        hookName: 'continuity-handoff',
        config: expect.objectContaining({
          outputTargets: ['sidecar-file'],
          outputFile: expect.objectContaining({
            baseDir: 'system-workdir',
            relativeDir: 'handoff/{{conversationId}}',
            fileBaseName: 'latest',
          }),
        }),
      });
    });

    expect(handleRefreshHooksMock).toHaveBeenCalled();
  });
});

describe('MessageTips sidecar actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openFileMock.mockResolvedValue(undefined);
    showItemInFolderMock.mockResolvedValue(undefined);
  });

  it('opens exported markdown and reveals its folder from sidecar tip actions', async () => {
    render(
      <MessageTips
        message={{
          id: 'tip-1',
          conversation_id: 'conv-1',
          type: 'tips',
          position: 'center',
          content: {
            content:
              'Sidecar files exported.<br/>Markdown: <code>/tmp/export/latest.md</code><br/>Metadata: <code>/tmp/export/latest.json</code>',
            type: 'success',
            actions: [
              {
                label: 'Open Markdown',
                action: 'open-file',
                path: '/tmp/export/latest.md',
              },
              {
                label: 'Show In Folder',
                action: 'show-item-in-folder',
                path: '/tmp/export/latest.md',
              },
            ],
          },
        }}
      />
    );

    fireEvent.click(screen.getByText('Open Markdown'));
    await waitFor(() => {
      expect(openFileMock).toHaveBeenCalledWith('/tmp/export/latest.md');
    });

    fireEvent.click(screen.getByText('Show In Folder'));
    await waitFor(() => {
      expect(showItemInFolderMock).toHaveBeenCalledWith('/tmp/export/latest.md');
    });
  });

  it('shows an error toast when a sidecar action fails', async () => {
    openFileMock.mockRejectedValue(new Error('open failed'));

    render(
      <MessageTips
        message={{
          id: 'tip-2',
          conversation_id: 'conv-1',
          type: 'tips',
          position: 'center',
          content: {
            content: 'Sidecar files exported.',
            type: 'success',
            actions: [
              {
                label: 'Open Markdown',
                action: 'open-file',
                path: '/tmp/export/latest.md',
              },
            ],
          },
        }}
      />
    );

    fireEvent.click(screen.getByText('Open Markdown'));

    await waitFor(() => {
      expect(errorMessageMock).toHaveBeenCalledWith('open failed');
    });
  });
});
