import type { TChatConversation } from '@/common/config/storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAvailableSkillsMock = vi.fn();
const getProjectCapabilitySnapshotMock = vi.fn();
const useScheduleJobsMock = vi.fn();
const {
  managedCommandLibraryEditorState,
  readFileInvokeMock,
  readSkillContentInvokeMock,
  getSlashCommandsInvokeMock,
  translationMockState,
} =
  vi.hoisted(() => ({
    managedCommandLibraryEditorState: {
      current: null as
        | null
        | {
            loadLibrary: () => Promise<unknown>;
            saveLibrary: (nextLibrary: unknown[]) => Promise<void>;
          },
    },
    readFileInvokeMock: vi.fn(),
    readSkillContentInvokeMock: vi.fn(),
    getSlashCommandsInvokeMock: vi.fn(async () => ({ success: true, data: { managedLibrary: [], commands: [] } })),
    translationMockState: {
      unstableIdentity: false,
    },
  }));
const tMock = (key: string, options?: { defaultValue?: string; path?: string }) => options?.defaultValue ?? key;
const messageApiMock = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translationMockState.unstableIdentity ? ((...args: Parameters<typeof tMock>) => tMock(...args)) : tMock,
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      listAvailableSkills: { invoke: (...args: unknown[]) => listAvailableSkillsMock(...args) },
      listAvailableHooks: { invoke: vi.fn(async () => []) },
      readFile: { invoke: (...args: unknown[]) => readFileInvokeMock(...args) },
      readSkillContent: { invoke: (...args: unknown[]) => readSkillContentInvokeMock(...args) },
      writeFile: { invoke: vi.fn() },
    },
    conversation: {
      getProjectCapabilitySnapshot: {
        invoke: (...args: unknown[]) => getProjectCapabilitySnapshotMock(...args),
      },
      getSlashCommands: {
        invoke: (...args: unknown[]) => getSlashCommandsInvokeMock(...args),
      },
      update: { invoke: vi.fn(async () => true) },
    },
    schedule: {
      createConversationSchedule: { invoke: vi.fn() },
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
    loadLibrary: () => Promise<unknown>;
    saveLibrary: (nextLibrary: unknown[]) => Promise<void>;
  }) => {
    managedCommandLibraryEditorState.current = props;
    return <div data-testid='managed-command-library-editor' />;
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
      const normalizeKey = (value: React.Key | null): string => String(value ?? '').replace(/^[.$]+/, '');
      const activePane = panes.find((pane) => normalizeKey(pane.key) === activeTab) ?? panes[0] ?? null;

      return (
        <div>
          <div>
            {panes.map((pane) => {
              const paneKey = normalizeKey(pane.key);
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
    backend: 'codex',
    enabledSkills: ['release-guard'],
    enabledHooks: ['continuity-handoff'],
  },
} as TChatConversation;

describe('ProjectAutomationModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    managedCommandLibraryEditorState.current = null;
    translationMockState.unstableIdentity = false;
    readFileInvokeMock.mockResolvedValue('[]');
    readSkillContentInvokeMock.mockResolvedValue({
      success: true,
      data: {
        content: '---\nname: release-guard\ndescription: Keep release work narrow.\n---\n\n## Usage\n\nStay focused.\n',
      },
    });
    getSlashCommandsInvokeMock.mockResolvedValue({ success: true, data: { managedLibrary: [], commands: [] } });
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

  it('treats workspace project skills as enabled even when the conversation has no explicit enabledSkills', async () => {
    const conversationWithoutExplicitSkills = {
      ...conversation,
      extra: {
        ...conversation.extra,
        enabledSkills: [],
      },
    } as TChatConversation;

    render(
      <ProjectAutomationModal visible={true} conversation={conversationWithoutExplicitSkills} onClose={() => undefined} />
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
      expect(screen.getByTestId('managed-command-library-editor')).toBeInTheDocument();
      expect(managedCommandLibraryEditorState.current).not.toBeNull();
    });

    await expect(managedCommandLibraryEditorState.current!.loadLibrary()).resolves.toEqual([]);
    expect(getSlashCommandsInvokeMock).not.toHaveBeenCalled();
  });
});
