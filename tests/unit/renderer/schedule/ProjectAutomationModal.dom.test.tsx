import type { TChatConversation } from '@/common/config/storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAvailableSkillsMock = vi.fn();
const getProjectCapabilitySnapshotMock = vi.fn();
const useScheduleJobsMock = vi.fn();
const {
  managedCommandLibraryEditorState,
  projectSkillMarketState,
  readFileInvokeMock,
  getSpaceCommandLibraryInvokeMock,
  saveSpaceCommandLibraryInvokeMock,
  writeFileInvokeMock,
  readSkillContentInvokeMock,
  importProjectRuntimeInvokeMock,
  resetProjectRuntimeInvokeMock,
  saveProjectRuntimePolicyInvokeMock,
  translationMockState,
} = vi.hoisted(() => ({
  managedCommandLibraryEditorState: {
    current: [] as Array<{
      titleText: string;
      loadLibrary: () => Promise<unknown>;
      saveLibrary: (nextLibrary: unknown[]) => Promise<void>;
    }>,
  },
  projectSkillMarketState: {
    current: null as null | {
      variant?: 'modal' | 'embedded';
      visible: boolean;
      workspacePath: string;
    },
  },
  readFileInvokeMock: vi.fn(),
  getSpaceCommandLibraryInvokeMock: vi.fn(async () => []),
  saveSpaceCommandLibraryInvokeMock: vi.fn(async () => []),
  writeFileInvokeMock: vi.fn(),
  readSkillContentInvokeMock: vi.fn(),
  importProjectRuntimeInvokeMock: vi.fn(),
  resetProjectRuntimeInvokeMock: vi.fn(),
  saveProjectRuntimePolicyInvokeMock: vi.fn(),
  translationMockState: {
    unstableIdentity: false,
  },
}));
const tMock = (key: string, options?: Record<string, unknown> & { defaultValue?: string }) => {
  const template = options?.defaultValue ?? key;
  return Object.entries(options ?? {}).reduce((result, [optionKey, optionValue]) => {
    if (optionKey === 'defaultValue' || optionValue === undefined || optionValue === null) {
      return result;
    }

    return result.replace(new RegExp(`{{${optionKey}}}`, 'g'), String(optionValue));
  }, template);
};
const normalizeTabKey = (value: React.Key | null): string => String(value ?? '').replace(/^[.$]+/, '');
const messageApiMock = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translationMockState.unstableIdentity ? (...args: Parameters<typeof tMock>) => tMock(...args) : tMock,
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      listAvailableSkills: { invoke: (...args: unknown[]) => listAvailableSkillsMock(...args) },
      listAvailableHooks: { invoke: vi.fn(async () => []) },
      readFile: { invoke: (...args: unknown[]) => readFileInvokeMock(...args) },
      readSkillContent: { invoke: (...args: unknown[]) => readSkillContentInvokeMock(...args) },
      writeFile: { invoke: (...args: unknown[]) => writeFileInvokeMock(...args) },
    },
    space: {
      getCommandLibrary: {
        invoke: (...args: unknown[]) => getSpaceCommandLibraryInvokeMock(...args),
      },
      saveCommandLibrary: {
        invoke: (...args: unknown[]) => saveSpaceCommandLibraryInvokeMock(...args),
      },
    },
    conversation: {
      getProjectCapabilitySnapshot: {
        invoke: (...args: unknown[]) => getProjectCapabilitySnapshotMock(...args),
      },
      update: { invoke: vi.fn(async () => true) },
    },
    schedule: {
      createConversationSchedule: { invoke: vi.fn() },
    },
    acpConversation: {
      importProjectRuntime: {
        invoke: (...args: unknown[]) => importProjectRuntimeInvokeMock(...args),
      },
      resetProjectRuntime: {
        invoke: (...args: unknown[]) => resetProjectRuntimeInvokeMock(...args),
      },
      saveProjectRuntimePolicy: {
        invoke: (...args: unknown[]) => saveProjectRuntimePolicyInvokeMock(...args),
      },
    },
  },
}));

vi.mock('@/renderer/pages/schedule/useScheduleJobs', () => ({
  useScheduleJobs: (...args: unknown[]) => useScheduleJobsMock(...args),
}));

vi.mock('@/renderer/pages/schedule/schedulePresetUtils', () => ({
  getScheduleDirectCreateContext: () => ({
    conversationId: 'conv-1',
    conversationTitle: 'Project Automation',
    workspacePath: '/tmp/workspace',
    agentType: 'codex',
  }),
}));

vi.mock('@/renderer/hooks/agent/usePresetAssistantInfo', () => ({
  usePresetAssistantInfo: () => ({
    info: {
      name: 'Release Guard Assistant',
      logo: 'RG',
      isEmoji: true,
    },
    isLoading: false,
  }),
}));

vi.mock('@/renderer/pages/settings/ToolsSettings/ManagedCommandLibraryEditor', () => ({
  __esModule: true,
  default: (props: {
    title?: React.ReactNode;
    loadLibrary: () => Promise<unknown>;
    saveLibrary: (nextLibrary: unknown[]) => Promise<void>;
  }) => {
    const titleText = typeof props.title === 'string' ? props.title : '';
    managedCommandLibraryEditorState.current.push({
      titleText,
      loadLibrary: props.loadLibrary,
      saveLibrary: props.saveLibrary,
    });
    return <div data-testid='managed-command-library-editor'>{titleText}</div>;
  },
}));

vi.mock('@/renderer/pages/conversation/ProjectSkillMarketModal', () => ({
  __esModule: true,
  default: ({
    visible,
    workspacePath,
    variant,
  }: {
    visible: boolean;
    workspacePath: string;
    variant?: 'modal' | 'embedded';
    onClose?: () => void;
  }) => {
    projectSkillMarketState.current = {
      visible,
      workspacePath,
      variant,
    };
    return visible ? (
      <div data-testid='project-skill-market-panel'>{`${variant ?? 'modal'}:${workspacePath}`}</div>
    ) : null;
  },
}));

vi.mock('@/renderer/components/settings', () => ({
  SettingsSubModal: ({
    visible,
    title,
    children,
  }: {
    visible: boolean;
    title?: React.ReactNode;
    children?: React.ReactNode;
  }) =>
    visible ? (
      <div data-testid='settings-sub-modal'>
        <div>{title}</div>
        <div>{children}</div>
      </div>
    ) : null,
}));

vi.mock('@/renderer/components/automation', () => ({
  AutomationPanel: ({
    title,
    description,
    meta,
    actions,
    children,
  }: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    meta?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <section>
      <div>{title}</div>
      <div>{description}</div>
      <div>{meta}</div>
      <div>{actions}</div>
      <div>{children}</div>
    </section>
  ),
  AutomationSectionCard: ({
    title,
    description,
    extra,
    actions,
    children,
  }: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    extra?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <section>
      <div>{title}</div>
      <div>{description}</div>
      <div>{extra}</div>
      <div>{actions}</div>
      <div>{children}</div>
    </section>
  ),
}));

vi.mock('@/renderer/components/Markdown', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Checkbox: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
    <input type='checkbox' checked={checked} onChange={() => onChange?.(!checked)} />
  ),
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
      TextArea: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
        <textarea value={value} onChange={(event) => onChange?.(event.target.value)} />
      ),
    }
  ),
  Message: {
    useMessage: () => [messageApiMock, <div key='message-context' />],
  },
  Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
    <input type='checkbox' checked={checked} onChange={() => onChange?.(!checked)} />
  ),
  Tabs: Object.assign(
    ({
      activeTab,
      children,
      onChange,
    }: {
      activeTab: string;
      children?: React.ReactNode;
      onChange?: (key: string) => void;
    }) => {
      const panes = React.Children.toArray(children) as Array<React.ReactElement<{ title?: React.ReactNode }>>;
      const activePane = panes.find((pane) => normalizeTabKey(pane.key) === activeTab) ?? panes[0] ?? null;

      return (
        <div>
          <div>
            {panes.map((pane) => {
              const paneKey = normalizeTabKey(pane.key);
              return (
                <button key={paneKey} type='button' onClick={() => onChange?.(paneKey)}>
                  {pane.props.title}
                </button>
              );
            })}
          </div>
          {activePane}
        </div>
      );
    },
    {
      TabPane: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    }
  ),
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    Title: ({ children }: { children?: React.ReactNode }) => <h3>{children}</h3>,
  },
}));

vi.mock('@icon-park/react', () => ({
  AlarmClock: () => <span data-testid='icon-alarm-clock' />,
  Command: () => <span data-testid='icon-command' />,
  ConnectionPoint: () => <span data-testid='icon-connection-point' />,
  Play: () => <span data-testid='icon-play' />,
  Refresh: () => <span data-testid='icon-refresh' />,
  Tips: () => <span data-testid='icon-tips' />,
}));

import ProjectAutomationModal from '@/renderer/pages/schedule/components/ProjectAutomationModal';

const conversation: TChatConversation = {
  id: 'conv-1',
  type: 'acp',
  name: 'Project Automation',
  createTime: 1,
  modifyTime: 1,
  extra: {
    workspace: '/tmp/workspace',
    spaceId: 'space-1',
    backend: 'codex',
    enabledSkills: ['release-guard'],
    enabledHooks: ['continuity-handoff'],
  },
} as TChatConversation;

describe('ProjectAutomationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managedCommandLibraryEditorState.current = [];
    projectSkillMarketState.current = null;
    translationMockState.unstableIdentity = false;
    readFileInvokeMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/tmp/workspace/.contextgo/runtime.json') {
        return JSON.stringify(
          {
            version: 1,
            mode: 'auto',
            resolvedSource: 'model_center',
            providerProtocol: 'openai',
            baseUrl: null,
            apiKeyRef: null,
            defaultModel: null,
            importedFrom: null,
            lastImportedAt: null,
          },
          null,
          2
        );
      }

      return '[]';
    });
    getSpaceCommandLibraryInvokeMock.mockResolvedValue([
      {
        id: 'space-plan',
        enabled: true,
        name: 'plan',
        description: 'Shared Space plan',
        template: 'Use the shared Space plan template.',
      },
    ]);
    saveSpaceCommandLibraryInvokeMock.mockResolvedValue([]);
    readSkillContentInvokeMock.mockResolvedValue({
      success: true,
      data: {
        content: '---\nname: release-guard\ndescription: Keep release work narrow.\n---\n\n## Usage\n\nStay focused.\n',
      },
    });
    writeFileInvokeMock.mockReset();
    writeFileInvokeMock.mockResolvedValue(undefined);
    importProjectRuntimeInvokeMock.mockReset();
    importProjectRuntimeInvokeMock.mockResolvedValue({
      success: true,
      data: {
        backend: 'codex',
        policy: {
          version: 1,
          mode: 'import_local_runtime',
          resolvedSource: 'imported_local_runtime',
          providerProtocol: 'openai',
          baseUrl: null,
          apiKeyRef: null,
          defaultModel: null,
          importedFrom: { codex: '~/.codex/config.toml' },
          lastImportedAt: '2026-04-18T10:00:00.000Z',
        },
        effectiveSource: 'imported_local_runtime',
        runtimeRoot: '/tmp/workspace/.contextgo',
      },
    });
    resetProjectRuntimeInvokeMock.mockReset();
    resetProjectRuntimeInvokeMock.mockResolvedValue({
      success: true,
      data: {
        backend: 'codex',
        policy: {
          version: 1,
          mode: 'project_managed',
          resolvedSource: 'model_center',
          providerProtocol: 'openai',
          baseUrl: null,
          apiKeyRef: null,
          defaultModel: null,
          importedFrom: null,
          lastImportedAt: null,
        },
        effectiveSource: 'model_center',
        runtimeRoot: '/tmp/workspace/.contextgo',
      },
    });
    saveProjectRuntimePolicyInvokeMock.mockReset();
    saveProjectRuntimePolicyInvokeMock.mockResolvedValue({
      success: true,
      data: {
        policy: {
          version: 1,
          mode: 'project_managed',
          resolvedSource: 'model_center',
          providerProtocol: 'openai',
          baseUrl: null,
          apiKeyRef: null,
          defaultModel: null,
          importedFrom: null,
          lastImportedAt: null,
        },
        effectiveSource: 'model_center',
        runtimeRoot: '/tmp/workspace/.contextgo',
      },
    });
    messageApiMock.success.mockReset();
    messageApiMock.error.mockReset();
    useScheduleJobsMock.mockReturnValue({
      jobs: [],
      loading: false,
      updateJob: vi.fn(),
      deleteJob: vi.fn(),
      runJobNow: vi.fn(),
    });
    listAvailableSkillsMock.mockResolvedValue([
      {
        name: 'release-guard',
        description: 'Keep rollout changes narrow and verifiable.',
        location: '/tmp/workspace/.contextgo/skills/release-guard/SKILL.md',
        isCustom: true,
        openAIConfig: {
          interface: {
            displayName: 'Release Guard',
            shortDescription: 'Keep release work narrow.',
          },
          policy: {
            allowImplicitInvocation: true,
          },
        },
      },
    ]);
    getProjectCapabilitySnapshotMock.mockResolvedValue({
      workspacePath: '/tmp/workspace',
      automationRootRelativePath: '.contextgo',
      counts: {
        skill: 1,
        hook: 0,
        command: 0,
        schedule: 0,
      },
      skills: [
        {
          kind: 'skill',
          id: 'release-guard',
          name: 'release-guard',
          description: 'Keep rollout changes narrow and verifiable.',
          docKey: 'skill:.contextgo/skills/release-guard',
          workspaceRelativePath: '.contextgo/skills/release-guard',
          compatibility: ['Requires command-line tool `git`'],
          implicitInvocation: true,
          openAIDisplayName: 'Release Guard',
          openAIShortDescription: 'Keep release work narrow.',
        },
      ],
      hooks: [],
      commands: [],
      schedules: [],
    });
  });

  it('shows project-local skills inside the automation modal', async () => {
    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    await waitFor(() => {
      expect(listAvailableSkillsMock).toHaveBeenCalledWith({ workspacePath: '/tmp/workspace' });
      expect(getProjectCapabilitySnapshotMock).toHaveBeenCalledWith({ workspacePath: '/tmp/workspace' });
    });

    expect(await screen.findByText('release-guard')).toBeInTheDocument();
    expect(screen.getByText('Release Guard')).toBeInTheDocument();
    expect(screen.getByText('Keep release work narrow.')).toBeInTheDocument();
    expect(screen.getByText('.contextgo/skills/release-guard')).toBeInTheDocument();
    expect(screen.getByText('Requires command-line tool `git`')).toBeInTheDocument();
    expect(screen.getByText(/Release Guard Assistant/)).toBeInTheDocument();
    expect(screen.getByTestId('project-skill-market-panel')).toHaveTextContent('embedded:/tmp/workspace');
  });

  it('does not repeatedly reload project skills when translation hook identity changes across renders', async () => {
    translationMockState.unstableIdentity = true;

    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('Release Guard')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(listAvailableSkillsMock).toHaveBeenCalledTimes(1);
      expect(getProjectCapabilitySnapshotMock).toHaveBeenCalledTimes(1);
    });
  });

  it('loads the project runtime policy from .contextgo/runtime.json', async () => {
    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));

    await waitFor(() => {
      expect(readFileInvokeMock).toHaveBeenCalledWith({ path: '/tmp/workspace/.contextgo/runtime.json' });
    });

    expect(await screen.findByText('Automatic')).toBeInTheDocument();
    expect(screen.getAllByText(/\.contextgo\/runtime\.json/).length).toBeGreaterThan(0);
  });

  it('saves the selected runtime mode through the runtime policy bridge', async () => {
    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use ContextGo model center' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save runtime policy' }));

    await waitFor(() => {
      expect(saveProjectRuntimePolicyInvokeMock).toHaveBeenCalledWith({
        workspace: '/tmp/workspace',
        policy: expect.objectContaining({
          mode: 'project_managed',
        }),
      });
    });
  });

  it('imports the current global runtime through the runtime action bridge', async () => {
    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import current global config' }));

    await waitFor(() => {
      expect(importProjectRuntimeInvokeMock).toHaveBeenCalledWith({
        workspace: '/tmp/workspace',
        backend: 'codex',
      });
    });

    expect(await screen.findByText(/Current effective source: Imported local runtime/)).toBeInTheDocument();
    expect(screen.getByText(/Current mode: Import local runtime config/)).toBeInTheDocument();
  });

  it('shows a re-import action when the runtime is already imported and uses the bridge result to refresh state', async () => {
    readFileInvokeMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/tmp/workspace/.contextgo/runtime.json') {
        return JSON.stringify(
          {
            version: 1,
            mode: 'import_local_runtime',
            resolvedSource: 'imported_local_runtime',
            providerProtocol: 'openai',
            baseUrl: null,
            apiKeyRef: null,
            defaultModel: null,
            importedFrom: { codex: '~/.codex/config.toml' },
            lastImportedAt: '2026-04-17T10:00:00.000Z',
          },
          null,
          2
        );
      }

      return '[]';
    });

    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Re-import global config' }));

    await waitFor(() => {
      expect(importProjectRuntimeInvokeMock).toHaveBeenCalledWith({
        workspace: '/tmp/workspace',
        backend: 'codex',
      });
    });
  });

  it('resets the current backend runtime override through the runtime action bridge', async () => {
    readFileInvokeMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/tmp/workspace/.contextgo/runtime.json') {
        return JSON.stringify(
          {
            version: 1,
            mode: 'import_local_runtime',
            resolvedSource: 'imported_local_runtime',
            providerProtocol: 'openai',
            baseUrl: null,
            apiKeyRef: null,
            defaultModel: null,
            importedFrom: { codex: '~/.codex/config.toml' },
            lastImportedAt: '2026-04-17T10:00:00.000Z',
          },
          null,
          2
        );
      }

      return '[]';
    });

    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reset current backend override' }));

    await waitFor(() => {
      expect(resetProjectRuntimeInvokeMock).toHaveBeenCalledWith({
        workspace: '/tmp/workspace',
        backend: 'codex',
      });
    });

    expect(await screen.findByText(/Current effective source: ContextGo model center/)).toBeInTheDocument();
    expect(screen.getByText(/Current mode: Use ContextGo model center/)).toBeInTheDocument();
  });

  it('saves runtime policy changes through the authoritative runtime bridge', async () => {
    readFileInvokeMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === '/tmp/workspace/.contextgo/runtime.json') {
        return JSON.stringify(
          {
            version: 1,
            mode: 'import_local_runtime',
            resolvedSource: 'imported_local_runtime',
            providerProtocol: 'openai',
            baseUrl: null,
            apiKeyRef: null,
            defaultModel: null,
            importedFrom: { codex: '~/.codex/config.toml' },
            lastImportedAt: '2026-04-17T10:00:00.000Z',
          },
          null,
          2
        );
      }

      return '[]';
    });

    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use ContextGo model center' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save runtime policy' }));

    await waitFor(() => {
      expect(saveProjectRuntimePolicyInvokeMock).toHaveBeenCalledWith({
        workspace: '/tmp/workspace',
        policy: expect.objectContaining({
          mode: 'project_managed',
        }),
      });
    });

    expect(writeFileInvokeMock).not.toHaveBeenCalledWith({
      path: '/tmp/workspace/.contextgo/runtime.json',
      data: expect.any(String),
    });
  });

  it('keeps the previous runtime state visible when an import action fails', async () => {
    importProjectRuntimeInvokeMock.mockResolvedValue({
      success: false,
      msg: 'import failed',
    });

    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Runtime' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import current global config' }));

    await waitFor(() => {
      expect(messageApiMock.error).toHaveBeenCalledWith('import failed');
    });

    expect(screen.queryByText('Imported local runtime')).not.toBeInTheDocument();
    expect(screen.getByText(/Current mode: Automatic/)).toBeInTheDocument();
  });

  it('treats workspace project skills as enabled even when the conversation has no explicit enabledSkills', async () => {
    const conversationWithoutExplicitSkills = {
      ...conversation,
      extra: {
        ...conversation.extra,
        enabledSkills: [],
      },
    } as TChatConversation;

    render(
      <ProjectAutomationModal
        visible={true}
        conversation={conversationWithoutExplicitSkills}
        onClose={() => undefined}
      />
    );

    await waitFor(() => {
      expect(listAvailableSkillsMock).toHaveBeenCalledWith({ workspacePath: '/tmp/workspace' });
      expect(getProjectCapabilitySnapshotMock).toHaveBeenCalledWith({ workspacePath: '/tmp/workspace' });
    });

    expect(screen.queryByText('conversation.workspace.automation.skillsSelectedEmpty')).not.toBeInTheDocument();
    expect(screen.getByText('release-guard')).toBeInTheDocument();
  });

  it('opens a skill preview modal with the skill markdown body when a project skill is clicked', async () => {
    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('Release Guard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Release Guard'));

    await waitFor(() => {
      expect(readSkillContentInvokeMock).toHaveBeenCalledWith({
        skillPath: '/tmp/workspace/.contextgo/skills/release-guard/SKILL.md',
      });
    });

    expect(
      await screen.findByText((content) => content.includes('## Usage') && content.includes('Stay focused.'))
    ).toBeInTheDocument();
    expect(screen.queryByText('name: release-guard')).not.toBeInTheDocument();
  });

  it('shows workspace-unavailable state without trying to load project skills', async () => {
    const conversationWithoutWorkspace = {
      ...conversation,
      extra: {
        ...conversation.extra,
        workspace: undefined,
        enabledSkills: [],
      },
    } as TChatConversation;

    render(
      <ProjectAutomationModal visible={true} conversation={conversationWithoutWorkspace} onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(listAvailableSkillsMock).not.toHaveBeenCalled();
      expect(getProjectCapabilitySnapshotMock).not.toHaveBeenCalled();
    });

    expect(screen.getAllByText('conversation.workspace.automation.workspaceUnavailable').length).toBeGreaterThan(0);
  });

  it('returns an empty project command list when commands.json is missing without slash fallback', async () => {
    readFileInvokeMock.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'settings.commands.title' }));

    await waitFor(() => {
      expect(screen.getAllByTestId('managed-command-library-editor')).toHaveLength(2);
    });

    const projectLocalEditor = managedCommandLibraryEditorState.current.find(
      (editor) => editor.titleText === 'Project Local Commands'
    );

    expect(projectLocalEditor).toBeDefined();
    await expect(projectLocalEditor!.loadLibrary()).resolves.toEqual([]);
  });

  it('loads and saves separate Space and project-local command libraries', async () => {
    render(<ProjectAutomationModal visible={true} conversation={conversation} onClose={() => undefined} />);

    fireEvent.click(screen.getByRole('button', { name: 'settings.commands.title' }));

    await waitFor(() => {
      expect(screen.getAllByTestId('managed-command-library-editor')).toHaveLength(2);
    });

    const spaceEditor = managedCommandLibraryEditorState.current.find(
      (editor) => editor.titleText === 'Space Commands'
    );
    const projectLocalEditor = managedCommandLibraryEditorState.current.find(
      (editor) => editor.titleText === 'Project Local Commands'
    );

    expect(spaceEditor).toBeDefined();
    expect(projectLocalEditor).toBeDefined();

    await expect(spaceEditor!.loadLibrary()).resolves.toEqual([
      {
        id: 'space-plan',
        enabled: true,
        name: 'plan',
        description: 'Shared Space plan',
        template: 'Use the shared Space plan template.',
      },
    ]);
    expect(getSpaceCommandLibraryInvokeMock).toHaveBeenCalledWith({ id: 'space-1' });

    await spaceEditor!.saveLibrary([
      {
        id: 'space-review',
        enabled: true,
        name: 'review',
        description: 'Shared review command',
        template: 'Review the change against the shared Space checklist.',
      },
    ]);
    expect(saveSpaceCommandLibraryInvokeMock).toHaveBeenCalledWith({
      id: 'space-1',
      commands: [
        {
          id: 'space-review',
          enabled: true,
          name: 'review',
          description: 'Shared review command',
          template: 'Review the change against the shared Space checklist.',
        },
      ],
    });

    await expect(projectLocalEditor!.loadLibrary()).resolves.toEqual([]);
  });
});
