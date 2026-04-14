import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentPackageManifest } from '@/common/config/presets/agentPackageManifest';
import type { AssistantListItem } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import type { AssistantWorkspaceModel } from '@/renderer/pages/settings/AgentSettings/Workspace/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

const markdownViewMock = vi.fn();

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children, allowHtml }: { children: React.ReactNode; allowHtml?: boolean }) => {
    markdownViewMock({ children, allowHtml });
    return <div>{children}</div>;
  },
}));

const readSkillContentInvoke = vi.fn();
const readBundledAgentPackageContentInvoke = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      readSkillContent: {
        invoke: (...args: unknown[]) => readSkillContentInvoke(...args),
      },
      readBundledAgentPackageContent: {
        invoke: (...args: unknown[]) => readBundledAgentPackageContentInvoke(...args),
      },
    },
  },
}));

vi.mock('@icon-park/react', () => ({
  Left: () => <span>left</span>,
}));

vi.mock('@arco-design/web-react', () => ({
  Avatar: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Button: ({
    children,
    onClick,
  }: React.PropsWithChildren<{
    onClick?: () => void;
  }>) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Tabs: Object.assign(
    ({
      activeTab,
      onChange,
      children,
    }: React.PropsWithChildren<{
      activeTab?: string;
      onChange?: (value: string) => void;
    }>) => {
      const panes = React.Children.toArray(children) as React.ReactElement[];
      const activePane = panes.find((pane) => String(pane.key) === activeTab) ?? panes[0] ?? null;

      return (
        <div>
          <div role='tablist'>
            {panes.map((pane) => (
              <button
                key={String(pane.key)}
                role='tab'
                aria-selected={String(pane.key) === activeTab}
                type='button'
                onClick={() => onChange?.(String(pane.key))}
              >
                {pane.props.title}
              </button>
            ))}
          </div>
          <div>{activePane?.props.children}</div>
        </div>
      );
    },
    {
      TabPane: ({ children }: React.PropsWithChildren<{ title?: React.ReactNode }>) => <>{children}</>,
    }
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Tag: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
}));

import AgentDetailPage from '@/renderer/pages/settings/AgentSettings/Workspace/detail/AgentDetailPage';

const assistant = {
  id: 'builtin-superpowers',
  name: 'Superpowers Harness',
  description: 'Engineering harness',
  enabled: true,
  isPreset: true,
  isBuiltin: true,
  presetAgentType: 'codex',
} as AssistantListItem;

const packageManifest: AgentPackageManifest = {
  protocolVersion: 'agent-package.v1',
  packageId: 'superpowers',
  assistantPresetId: 'builtin-superpowers',
  displayName: 'Superpowers Harness',
  runtimeNeutral: true,
  entryDocument: {
    file: 'AGENTS.md',
    runtimeEntryProjections: [
      {
        runtime: 'claude',
        target: 'CLAUDE.md',
      },
      {
        runtime: 'gemini',
        target: 'GEMINI.md',
      },
    ],
  },
  docsDirectory: {
    root: 'docs',
  },
  payloads: {
    skills: undefined,
  },
};

const model: AssistantWorkspaceModel = {
  assistant,
  packageManifest,
  packageDescriptor: undefined,
  agentsDocument: {
    id: 'AGENTS.md',
    title: 'Superpowers Harness Package',
    relativePath: 'AGENTS.md',
    sourcePath: '/assistant/AGENTS.md',
    content: '# Superpowers Harness Package\n\n## Boundaries\n\nPackage notes.',
  },
  docs: [
    {
      id: 'README.md',
      title: 'Overview',
      relativePath: 'README.md',
      sourcePath: '/assistant/docs/README.md',
      content: '# Overview\n\nGeneral package notes.',
    },
    {
      id: 'guides/setup.md',
      title: 'Setup Guide',
      relativePath: 'guides/setup.md',
      sourcePath: '/assistant/docs/guides/setup.md',
      content: '# Setup Guide\n\nDetailed setup flow.',
    },
  ],
  docsTree: [
    {
      id: 'README.md',
      label: 'README',
      path: 'README.md',
      children: [],
    },
    {
      id: 'guides',
      label: 'guides',
      children: [
        {
          id: 'guides/setup.md',
          label: 'setup',
          path: 'guides/setup.md',
          children: [],
        },
      ],
    },
  ],
  commands: [
    {
      id: 'harness-brainstorm',
      label: 'brainstorm',
      summary: 'Turn a vague request into an explicit design before implementation.',
      profile: 'contextgo-harness',
      installSurface: '.contextgo/commands.json',
      commandId: 'harness-brainstorm',
      template:
        'Use the `brainstorming` skill for this request. Explore the repository context, clarify the goal and constraints, compare a small number of approaches, then present a concrete design before editing files.',
      enabled: true,
      sourceKind: 'custom',
    },
  ],
  schedules: [],
  relevantSkills: [
    {
      name: 'using-superpowers',
      description: 'Bootstraps mandatory skill usage.',
      isCustom: false,
      isPending: false,
      location: '/tmp/using-superpowers',
    },
  ],
  relevantHooks: [
    {
      name: 'repo-context-bootstrap',
      description: 'Loads repo context before execution.',
      isCustom: false,
      hook: {
        name: 'repo-context-bootstrap',
        description: 'Loads repo context before execution.',
        isCustom: false,
        location: '/tmp/hooks/repo-context-bootstrap.json',
        version: '1.0.0',
        executionType: 'native-projection',
        events: ['after_response'],
        runnableEvents: ['after_response'],
        supportedBackends: ['codex'],
        category: 'operations',
        outputTargets: ['chat-message'],
        tags: ['repo', 'bootstrap'],
      },
    },
  ],
  availableTabs: ['skills', 'hooks', 'commands', 'agents', 'docs'],
  defaultTab: 'skills',
  isEditable: false,
};

const editor = {
  editAvatar: '\u{1F916}',
} as never;

const renderDetailPage = ({
  path,
  tabId = 'skills',
  nextModel = model,
}: {
  path: string;
  tabId?: string;
  nextModel?: AssistantWorkspaceModel;
}) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path='/agents/:assistantId/:tabId'
          element={
            <AgentDetailPage
              assistant={assistant}
              model={nextModel}
              tabId={tabId}
              localeKey='en-US'
              editor={editor}
              onInitializeAssistant={vi.fn()}
            />
          }
        />
      </Routes>
    </MemoryRouter>
  );
};

describe('AgentDetailPage tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSkillContentInvoke.mockResolvedValue({
      success: true,
      data: {
        content:
          '---\nname: using-superpowers\ndescription: Use when starting any conversation.\n---\n\n# Using Superpowers\n\n## Workflow\n\nRead the standard SKILL.md body.',
      },
    });
    readBundledAgentPackageContentInvoke.mockResolvedValue({
      success: true,
      data: {
        agentsDocument: model.agentsDocument,
        docs: model.docs,
      },
    });
  });

  it('renders the main surface switcher as a horizontal tab strip', () => {
    const { container } = renderDetailPage({ path: '/agents/builtin-superpowers/skills' });

    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Hooks' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Commands' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'AGENTS.md' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Docs' })).toBeInTheDocument();
    expect(screen.getAllByText('using-superpowers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bootstraps mandatory skill usage.').length).toBeGreaterThan(0);
    expect(container.firstElementChild?.className).toContain('surfaceFill');
  });

  it('keeps the skill index compact and renders the SKILL.md body in the detail pane', async () => {
    renderDetailPage({ path: '/agents/builtin-superpowers/skills' });

    expect(screen.getAllByText('Bootstraps mandatory skill usage.')).toHaveLength(1);

    await waitFor(() => {
      expect(readSkillContentInvoke).toHaveBeenCalledWith({ skillPath: '/tmp/using-superpowers' });
    });

    expect(markdownViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowHtml: true,
      })
    );
    expect(screen.getByText(/Workflow/)).toBeInTheDocument();
    expect(screen.getByText(/Read the standard SKILL\.md body\./)).toBeInTheDocument();
  });

  it('keeps the AGENTS.md tab visible when rules metadata declares a packaged entry document', () => {
    const modelWithoutAgentsDocument: AssistantWorkspaceModel = {
      ...model,
      agentsDocument: null,
      availableTabs: ['skills', 'agents', 'docs'],
    };

    renderDetailPage({
      path: '/agents/builtin-superpowers/skills',
      nextModel: modelWithoutAgentsDocument,
    });

    expect(screen.getByRole('tab', { name: 'AGENTS.md' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Docs' })).toBeInTheDocument();
  });

  it('renders AGENTS.md as the packaged rules entry page', () => {
    renderDetailPage({
      path: '/agents/builtin-superpowers/agents',
      tabId: 'agents',
    });

    expect(screen.getByText('Superpowers Harness Package')).toBeInTheDocument();
    expect(screen.getByText(/Package notes\./)).toBeInTheDocument();
  });

  it('renders docs as a tree reader and respects the selected doc query', () => {
    renderDetailPage({
      path: '/agents/builtin-superpowers/docs?doc=guides/setup.md',
      tabId: 'docs',
    });

    expect(screen.getByText('README')).toBeInTheDocument();
    expect(screen.getByText('setup')).toBeInTheDocument();
    expect(screen.getByText('Setup Guide')).toBeInTheDocument();
    expect(screen.getByText(/Detailed setup flow\./)).toBeInTheDocument();
  });

  it('renders hooks with operational metadata instead of a generic summary-only card', () => {
    renderDetailPage({
      path: '/agents/builtin-superpowers/hooks',
      tabId: 'hooks',
    });

    expect(screen.getAllByText('Loads repo context before execution.')).toHaveLength(1);
    expect(screen.getByText('Execution')).toBeInTheDocument();
    expect(screen.getAllByText('native-projection').length).toBeGreaterThan(0);
    expect(screen.getAllByText('after_response').length).toBeGreaterThan(0);
    expect(screen.getByText('/tmp/hooks/repo-context-bootstrap.json')).toBeInTheDocument();
    expect(screen.getByText('Output targets')).toBeInTheDocument();
    expect(screen.getByText('chat-message')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
  });

  it('renders commands with actual command detail sections', () => {
    renderDetailPage({
      path: '/agents/builtin-superpowers/commands',
      tabId: 'commands',
    });

    expect(screen.getAllByText('Turn a vague request into an explicit design before implementation.')).toHaveLength(1);
    expect(screen.getByText('Command id')).toBeInTheDocument();
    expect(screen.getByText('harness-brainstorm')).toBeInTheDocument();
    expect(screen.getByText('Prompt template')).toBeInTheDocument();
    expect(screen.getByText(/Use the `brainstorming` skill/)).toBeInTheDocument();
  });
});
