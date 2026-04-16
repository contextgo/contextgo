import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';

const handleCreateMock = vi.fn();
const handleEditMock = vi.fn();
const handleDuplicateMock = vi.fn();
const handleToggleEnabledMock = vi.fn();

const assistantFixture = {
  id: 'assistant-1',
  name: 'Research Agent',
  description: 'Summarize and draft',
  enabled: true,
  isPreset: true,
  isBuiltin: false,
  presetAgentType: 'codex',
} as AssistantListItem;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    useMessage: () => [{ success: vi.fn(), error: vi.fn(), warning: vi.fn() }, <div key='message-context' />],
  },
  Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Button: ({ children, onClick, className }: React.PropsWithChildren<{ onClick?: () => void; className?: string }>) => (
    <button type='button' onClick={onClick} className={className}>
      {children}
    </button>
  ),
  Tabs: Object.assign(
    ({
      activeTab,
      children,
    }: React.PropsWithChildren<{
      activeTab?: string;
    }>) => {
      const panes = React.Children.toArray(children) as React.ReactElement[];

      return (
        <div>
          <div role='tablist'>
            {panes.map((pane) => (
              <button key={String(pane.key)} role='tab' aria-selected={String(pane.key) === activeTab} type='button'>
                {pane.props.title}
              </button>
            ))}
          </div>
        </div>
      );
    },
    {
      TabPane: ({ children }: React.PropsWithChildren<{ title?: React.ReactNode }>) => <>{children}</>,
    }
  ),
  Tag: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock('@/renderer/hooks/assistant', () => ({
  useAssistantList: () => ({
    assistants: [assistantFixture],
    systemAssistants: [],
    activeAssistantId: 'assistant-1',
    setActiveAssistantId: vi.fn(),
    activeAssistant: assistantFixture,
    isReadonlyAssistant: false,
    isExtensionAssistant: () => false,
    loadAssistants: vi.fn(),
    localeKey: 'en-US',
  }),
  useAssistantBackends: () => ({
    availableBackends: new Set(['codex']),
    extensionAcpAdapters: [],
    refreshAgentDetection: vi.fn(),
  }),
  useAssistantEditor: () => ({
    handleCreate: handleCreateMock,
    handleEdit: handleEditMock,
    handleDuplicate: handleDuplicateMock,
    handleToggleEnabled: handleToggleEnabledMock,
    editName: 'Research Agent',
    setEditName: vi.fn(),
    editDescription: 'Summarize and draft',
    setEditDescription: vi.fn(),
    editAvatar: '\u{1F916}',
    setEditAvatar: vi.fn(),
    editAgent: 'codex',
    setEditAgent: vi.fn(),
    editContext: '',
    setEditContext: vi.fn(),
    promptViewMode: 'preview',
    setPromptViewMode: vi.fn(),
    isCreating: false,
    activeAssistant: assistantFixture,
    editVisible: false,
    setEditVisible: vi.fn(),
    deleteConfirmVisible: false,
    setDeleteConfirmVisible: vi.fn(),
    availableSkills: [],
    setAvailableSkills: vi.fn(),
    availableHooks: [],
    setAvailableHooks: vi.fn(),
    selectedSkills: ['repo-skill'],
    setSelectedSkills: vi.fn(),
    selectedHooks: [],
    setSelectedHooks: vi.fn(),
    customSkills: [],
    setCustomSkills: vi.fn(),
    pendingSkills: [],
    setPendingSkills: vi.fn(),
    deletePendingSkillName: null,
    setDeletePendingSkillName: vi.fn(),
    deleteCustomSkillName: null,
    setDeleteCustomSkillName: vi.fn(),
    skillsModalVisible: false,
    setSkillsModalVisible: vi.fn(),
    handleSave: vi.fn(),
    handleDeleteClick: vi.fn(),
    handleDeleteConfirm: vi.fn(),
  }),
}));

vi.mock('@/renderer/pages/settings/AgentSettings/AssistantManagement/AssistantListPanel', () => ({
  default: ({
    assistants,
    onCreate,
    onEdit,
    presentation,
  }: {
    assistants: AssistantListItem[];
    onCreate: () => void;
    onEdit: (assistant: AssistantListItem) => void;
    presentation?: 'auto' | 'embedded';
  }) => (
    <div>
      <div>{assistants[0]?.name}</div>
      {presentation !== 'embedded' ? (
        <button type='button' onClick={() => onCreate()}>
          Create Assistant
        </button>
      ) : null}
      <button type='button' onClick={() => onEdit(assistants[0])}>
        Open Assistant
      </button>
    </div>
  ),
}));

vi.mock('@/renderer/pages/settings/AgentSettings/Workspace/detail/AgentBasicsPanel', () => ({
  default: ({ mode }: { mode: 'create' | 'edit' }) => <div>{mode === 'create' ? 'Create Agent' : 'Agent Basics'}</div>,
}));

import Workspace from '@/renderer/pages/settings/AgentSettings/Workspace';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid='location'>{location.pathname}</div>;
};

describe('Agent workspace list route', () => {
  beforeEach(() => {
    handleCreateMock.mockReset();
    handleEditMock.mockReset();
    handleDuplicateMock.mockReset();
    handleToggleEnabledMock.mockReset();
  });

  it('renders the full-page list route and navigates to create and detail pages', async () => {
    const firstRender = render(
      <MemoryRouter initialEntries={['/agents']}>
        <Routes>
          <Route path='/agents/*' element={<Workspace />} />
          <Route path='*' element={<LocationProbe />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    expect(screen.getByText('Research Agent')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/agents');

    fireEvent.click(screen.getByRole('button', { name: 'Open Assistant' }));
    expect(handleEditMock).toHaveBeenCalledWith(assistantFixture, { openEditor: false });
    expect(await screen.findByTestId('location')).toHaveTextContent('/agents/assistant-1/skills');

    firstRender.unmount();

    render(
      <MemoryRouter initialEntries={['/agents']}>
        <Routes>
          <Route path='/agents/*' element={<Workspace />} />
          <Route path='*' element={<LocationProbe />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create Assistant' }));
    expect(handleCreateMock).toHaveBeenCalledWith({ openEditor: false });
    expect(await screen.findByTestId('location')).toHaveTextContent('/agents/new');
  });

  it('styles the create action with the workspace primary action class', () => {
    render(
      <MemoryRouter initialEntries={['/agents']}>
        <Routes>
          <Route path='/agents/*' element={<Workspace />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Create Assistant' }).className).toContain('primaryActionButton');
  });
});
