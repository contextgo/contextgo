import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';

const handleCreateMock = vi.fn();

const customAssistant = {
  id: 'assistant-1',
  name: 'Research Agent',
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
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
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
  Select: Object.assign(
    ({
      value,
      onChange,
      children,
    }: React.PropsWithChildren<{ value?: string; onChange?: (value: string) => void }>) => (
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {children}
      </select>
    ),
    {
      Option: ({ children, value }: React.PropsWithChildren<{ value: string }>) => (
        <option value={value}>{children}</option>
      ),
    }
  ),
  Tag: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

vi.mock('@/renderer/hooks/assistant', () => ({
  useAssistantList: () => ({
    assistants: [customAssistant],
    systemAssistants: [],
    activeAssistantId: 'assistant-1',
    setActiveAssistantId: vi.fn(),
    activeAssistant: customAssistant,
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
    handleEdit: vi.fn(),
    handleDuplicate: vi.fn(),
    handleToggleEnabled: vi.fn(),
    editName: '',
    setEditName: vi.fn(),
    editDescription: '',
    setEditDescription: vi.fn(),
    editAvatar: '\u{1F916}',
    setEditAvatar: vi.fn(),
    editAgent: 'codex',
    setEditAgent: vi.fn(),
    editContext: '',
    setEditContext: vi.fn(),
    promptViewMode: 'edit',
    setPromptViewMode: vi.fn(),
    isCreating: true,
    activeAssistant: null,
    editVisible: false,
    setEditVisible: vi.fn(),
    deleteConfirmVisible: false,
    setDeleteConfirmVisible: vi.fn(),
    availableSkills: [],
    setAvailableSkills: vi.fn(),
    availableHooks: [],
    setAvailableHooks: vi.fn(),
    selectedSkills: [],
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

import Workspace from '@/renderer/pages/settings/AgentSettings/Workspace';

describe('Agent workspace create route', () => {
  beforeEach(() => {
    handleCreateMock.mockReset();
  });

  it('initializes create mode inline and renders the create page', async () => {
    render(
      <MemoryRouter initialEntries={['/agents/new']}>
        <Routes>
          <Route path='/agents/*' element={<Workspace />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(handleCreateMock).toHaveBeenCalledWith({ openEditor: false });
    });

    expect(screen.getByText('Create Agent')).toBeInTheDocument();
    expect(screen.getByText('Define Work')).toBeInTheDocument();
  });
});
