import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';

const handleEditMock = vi.fn();
const readBundledAgentPackageContentInvoke = vi.fn().mockResolvedValue({
  success: true,
  data: {
    agentsDocument: {
      id: 'AGENTS.md',
      title: 'AGENTS.md',
      relativePath: 'AGENTS.md',
      sourcePath: '/tmp/AGENTS.md',
      content: '# PM Workbench',
    },
    docs: [],
  },
});

const assistantFixture = {
  id: 'assistant-1',
  name: 'Research Agent',
  description: 'Summarize and draft',
  enabled: true,
  isPreset: true,
  isBuiltin: false,
  presetAgentType: 'codex',
} as AssistantListItem;

const linkedAssistantFixture = {
  ...assistantFixture,
  id: 'custom-123',
  linkedPackagePresetId: 'builtin-pm-workbench',
} as AssistantListItem;

let currentAssistant = assistantFixture;
let currentAssistants: AssistantListItem[] = [assistantFixture];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      readBundledAgentPackageContent: { invoke: (...args: unknown[]) => readBundledAgentPackageContentInvoke(...args) },
      readSkillContent: { invoke: vi.fn().mockResolvedValue({ success: true, data: { content: '# Skill body' } }) },
    },
  },
}));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    useMessage: () => [{ success: vi.fn(), error: vi.fn(), warning: vi.fn() }, <div key='message-context' />],
  },
  Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type='button' onClick={onClick}>
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
    assistants: currentAssistants,
    systemAssistants: [],
    activeAssistantId: currentAssistant.id,
    setActiveAssistantId: vi.fn(),
    activeAssistant: currentAssistant,
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
    handleCreate: vi.fn(),
    handleEdit: handleEditMock,
    handleDuplicate: vi.fn(),
    handleToggleEnabled: vi.fn(),
    editName: currentAssistant.name,
    setEditName: vi.fn(),
    editDescription: currentAssistant.description,
    setEditDescription: vi.fn(),
    editAvatar: '\u{1F916}',
    setEditAvatar: vi.fn(),
    editAgent: 'codex',
    setEditAgent: vi.fn(),
    editContext: '# Rules',
    setEditContext: vi.fn(),
    promptViewMode: 'preview',
    setPromptViewMode: vi.fn(),
    isCreating: false,
    activeAssistant: currentAssistant,
    editVisible: false,
    setEditVisible: vi.fn(),
    deleteConfirmVisible: false,
    setDeleteConfirmVisible: vi.fn(),
    availableSkills: [
      {
        name: 'repo-skill',
        description: 'Repo helper',
        location: '/tmp/repo-skill',
        isCustom: false,
      },
    ],
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
  default: () => <div>assistant-list</div>,
}));

vi.mock('@/renderer/pages/settings/AgentSettings/Workspace/detail/AgentBasicsPanel', () => ({
  default: ({ mode }: { mode: 'create' | 'edit' }) => <div>{mode === 'create' ? 'Create Agent' : 'Agent Basics'}</div>,
}));

import Workspace from '@/renderer/pages/settings/AgentSettings/Workspace';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid='location'>{location.pathname}</div>;
};

describe('Agent workspace detail route', () => {
  beforeEach(() => {
    handleEditMock.mockReset();
    readBundledAgentPackageContentInvoke.mockClear();
    currentAssistant = assistantFixture;
    currentAssistants = [assistantFixture];
  });

  it('redirects assistant detail roots to the resolved default tab', async () => {
    render(
      <MemoryRouter initialEntries={['/agents/assistant-1']}>
        <Routes>
          <Route path='/agents/*' element={<Workspace />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('location')).toHaveTextContent('/agents/assistant-1/skills');
    expect(screen.getByText('Research Agent')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument();
    expect(handleEditMock).toHaveBeenCalledWith(assistantFixture, { openEditor: false });
  });

  it('loads bundled package content through linked package preset id for custom assistants', async () => {
    currentAssistant = linkedAssistantFixture;
    currentAssistants = [linkedAssistantFixture];

    render(
      <MemoryRouter initialEntries={['/agents/custom-123/agents']}>
        <Routes>
          <Route path='/agents/*' element={<Workspace />} />
        </Routes>
      </MemoryRouter>
    );

    expect(readBundledAgentPackageContentInvoke).toHaveBeenCalledWith({ assistantId: 'builtin-pm-workbench' });
  });
});
