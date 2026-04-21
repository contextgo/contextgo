import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';

const navigateMock = vi.fn();
const onCreateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      (
        ({
          'settings.assistants': 'AI Agent',
          'settings.createAssistant': 'Create Assistant',
          'settings.assistantsWorkbenchProductAgents': 'Product agents',
          'settings.assistantsWorkbenchProductAgentsHint': 'Direct-use agents available in this workspace.',
          'settings.assistantsWorkbenchSystemAgents': 'System agents',
          'settings.assistantsWorkbenchSystemAgentsHint': 'Background agents managed by Context Engine.',
          'settings.assistantsWorkbenchActiveRuns': 'Active runs',
          'settings.assistantsWorkbenchActiveRunsHint': 'Maintenance executions currently in progress.',
          'settings.assistantsList': 'Available assistants',
          'settings.productAssistantsDescription':
            'User-facing built-in, extension, and custom assistants for direct work.',
          'settings.systemAgents': 'System Agents',
          'settings.systemAgentsDescription':
            'Engine-managed agents run automatically in the background to compact session context and promote stable project knowledge.',
          'settings.systemAgentViewRuns': 'View Runs',
          'settings.assistantsPageDescription': 'Create and edit agents here for direct work in this workspace.',
          'agent.contextEngine.idleCount': `${String(options?.count ?? '0')} maintenance agents watching`,
          'agent.contextEngine.activeCount': `${String(options?.count ?? '0')} maintenance runs active`,
          'agent.contextEngine.empty': 'Waiting for the first maintenance run.',
          'agent.contextEngine.openConsole': 'Open Console',
          'agent.contextEngine.idle': 'Watching',
          'agent.contextEngine.taskFallback': 'No summary yet',
        }) as Record<string, string>
      )[key] ?? String(options?.defaultValue ?? key),
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    icon,
  }: React.PropsWithChildren<{
    onClick?: (event?: React.MouseEvent<HTMLButtonElement>) => void;
    icon?: React.ReactNode;
  }>) => (
    <button type='button' onClick={(event) => onClick?.(event)}>
      {icon}
      {children}
    </button>
  ),
  Collapse: {
    Item: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  },
  Switch: ({ checked }: { checked?: boolean }) => <input type='checkbox' checked={checked} readOnly />,
  Tag: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@icon-park/react', () => ({
  Plus: () => <span data-testid='plus-icon' />,
  SettingOne: () => <span data-testid='setting-icon' />,
}));

vi.mock('@/common/config/presets/systemAssistants', () => ({
  findContextEngineSystemAssistantByRole: () => undefined,
}));

vi.mock('@/renderer/components/settings/SettingsModal/settingsViewContext', () => ({
  useSettingsViewMode: () => 'page',
}));

vi.mock('@/renderer/hooks/agent/useContextEngineActivity', () => ({
  useContextEngineActivity: () => ({
    maintenanceAgents: [],
    activeMaintenanceCount: 2,
    status: 'ready',
  }),
}));

vi.mock('@/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils', () => ({
  getAssistantBadges: () => [],
}));

vi.mock('@/renderer/pages/settings/AgentSettings/AssistantManagement/AssistantAvatar', () => ({
  default: ({ assistant }: { assistant: { name: string } }) => <span>{assistant.name}</span>,
}));

import AssistantListPanel from '@/renderer/pages/settings/AgentSettings/AssistantManagement/AssistantListPanel';

describe('AssistantListPanel', () => {
  it('hides system agents from the page by default', () => {
    navigateMock.mockReset();
    onCreateMock.mockReset();

    const assistants = [
      {
        id: 'assistant-1',
        name: 'Research Agent',
        description: 'Summarize and draft',
        enabled: true,
      },
    ] as unknown as AssistantListItem[];

    const systemAssistants = [
      {
        id: 'system-1',
        name: 'Session Context Keeper',
        description: 'System-managed',
        systemRole: 'context-engine-session-compactor',
        triggerKinds: [],
      },
    ] as unknown as AssistantListItem[];

    render(
      <AssistantListPanel
        assistants={assistants}
        systemAssistants={systemAssistants}
        activeAssistantId={null}
        localeKey='en-US'
        avatarImageMap={{}}
        isExtensionAssistant={() => false}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onCreate={onCreateMock}
        onToggleEnabled={vi.fn()}
        setActiveAssistantId={vi.fn()}
      />
    );

    expect(screen.getByText('Create and edit agents here for direct work in this workspace.')).toBeInTheDocument();
    expect(screen.getByText('Product agents')).toBeInTheDocument();
    expect(screen.queryByText('System agents')).not.toBeInTheDocument();
    expect(screen.queryByText('Active runs')).not.toBeInTheDocument();
    expect(screen.queryByText('System Agents')).not.toBeInTheDocument();
    expect(screen.queryByText('Session Context Keeper')).not.toBeInTheDocument();
    expect(screen.queryByText('How this workspace works')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Create agents here, open any agent below to edit rules and attached skills, and use Skill Market when you need to install new capabilities.'
      )
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Agent Workbench')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publish Agent' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Skill Market' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Create Assistant' })[0]);
    expect(onCreateMock).toHaveBeenCalledTimes(1);
  });

  it('can render as an embedded workspace section without nesting another page hero shell', () => {
    navigateMock.mockReset();
    onCreateMock.mockReset();

    const assistants = [
      {
        id: 'assistant-1',
        name: 'Research Agent',
        description: 'Summarize and draft',
        enabled: true,
      },
    ] as unknown as AssistantListItem[];

    render(
      <AssistantListPanel
        assistants={assistants}
        systemAssistants={[]}
        activeAssistantId={null}
        localeKey='en-US'
        avatarImageMap={{}}
        isExtensionAssistant={() => false}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onCreate={onCreateMock}
        onToggleEnabled={vi.fn()}
        setActiveAssistantId={vi.fn()}
        presentation='embedded'
      />
    );

    expect(screen.getByText('Available assistants')).toBeInTheDocument();
    expect(
      screen.queryByText('Create and edit agents here for direct work in this workspace.')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Assistant' })).not.toBeInTheDocument();
  });

  it('can still render system agents when explicitly enabled', () => {
    const assistants = [
      {
        id: 'assistant-1',
        name: 'Research Agent',
        description: 'Summarize and draft',
        enabled: true,
      },
    ] as unknown as AssistantListItem[];

    const systemAssistants = [
      {
        id: 'system-1',
        name: 'Session Context Keeper',
        description: 'System-managed',
        systemRole: 'context-engine-session-compactor',
        triggerKinds: [],
      },
    ] as unknown as AssistantListItem[];

    render(
      <AssistantListPanel
        assistants={assistants}
        systemAssistants={systemAssistants}
        showSystemAssistants
        activeAssistantId={null}
        localeKey='en-US'
        avatarImageMap={{}}
        isExtensionAssistant={() => false}
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onCreate={vi.fn()}
        onToggleEnabled={vi.fn()}
        setActiveAssistantId={vi.fn()}
      />
    );

    expect(screen.getByText('System agents')).toBeInTheDocument();
    expect(screen.getByText('Active runs')).toBeInTheDocument();
    expect(screen.getAllByText('Session Context Keeper').length).toBeGreaterThan(0);
  });
});
