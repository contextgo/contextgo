import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AgentCreatePage from '@/renderer/pages/settings/AgentSettings/Workspace/create/AgentCreatePage';
import type { useAssistantEditor } from '@/renderer/hooks/assistant';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/renderer/pages/settings/AgentSettings/Workspace/detail/AgentBasicsPanel', () => ({
  default: () => <div data-testid='legacy-basics-panel'>legacy create panel</div>,
}));

const buildEditorStub = (): ReturnType<typeof useAssistantEditor> =>
  ({
    editName: '',
    setEditName: vi.fn(),
    editDescription: '',
    setEditDescription: vi.fn(),
    editAvatar: '🤖',
    setEditAvatar: vi.fn(),
    editAgent: 'codex',
    setEditAgent: vi.fn(),
    editContext: '',
    setEditContext: vi.fn(),
    promptViewMode: 'edit',
    setPromptViewMode: vi.fn(),
    handleSave: vi.fn().mockResolvedValue('custom-123'),
    handleCreate: vi.fn(),
    availableSkills: [],
    availableHooks: [],
    pendingSkills: [],
    selectedSkills: [],
    selectedHooks: [],
    customSkills: [],
  }) as unknown as ReturnType<typeof useAssistantEditor>;

describe('AgentCreatePage', () => {
  it('should render the status flow and progress from work definition to capability stack', async () => {
    render(
      <MemoryRouter>
        <AgentCreatePage
          activeAssistant={null}
          isReadonlyAssistant={false}
          availableBackends={new Set(['codex', 'gemini'])}
          extensionAcpAdapters={[]}
          editor={buildEditorStub()}
          onInitializeCreate={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Define Work')).toBeInTheDocument();
    expect(screen.getByText('Build Capability Stack')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('What work should this Agent take responsibility for?'), {
      target: { value: 'Turn discovery notes into a PRD and roadmap' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Identity & Rules')).toBeInTheDocument();
    expect(screen.getByText('Core Skills')).toBeInTheDocument();
    expect(screen.getByText('Automation')).toBeInTheDocument();
  });
});
