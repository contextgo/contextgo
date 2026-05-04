import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchSkillMarketInvokeMock = vi.fn();
const installSkillMarketSkillToWorkspaceInvokeMock = vi.fn();
const listAvailableSkillsInvokeMock = vi.fn();
const getProjectCapabilitySnapshotInvokeMock = vi.fn();
const messageApiMock = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
};
const translationMockState = {
  unstableIdentity: false,
};

const tMock = (key: string, options?: Record<string, unknown> & { defaultValue?: string }) => {
  const template = options?.defaultValue ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, token: string) => String(options?.[token] ?? ''));
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translationMockState.unstableIdentity ? (...args: Parameters<typeof tMock>) => tMock(...args) : tMock,
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      searchSkillMarket: { invoke: (...args: unknown[]) => searchSkillMarketInvokeMock(...args) },
      installSkillMarketSkillToWorkspace: {
        invoke: (...args: unknown[]) => installSkillMarketSkillToWorkspaceInvokeMock(...args),
      },
      listAvailableSkills: {
        invoke: (...args: unknown[]) => listAvailableSkillsInvokeMock(...args),
      },
    },
    conversation: {
      getProjectCapabilitySnapshot: {
        invoke: (...args: unknown[]) => getProjectCapabilitySnapshotInvokeMock(...args),
      },
    },
    shell: {
      openExternal: {
        invoke: vi.fn(),
      },
    },
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

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => (
    <button type='button' disabled={disabled || loading} onClick={onClick}>
      {children}
    </button>
  ),
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
    useMessage: () => [messageApiMock, <div key='message-context' />],
  },
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  },
}));

vi.mock('@icon-park/react', () => ({
  Refresh: () => <span data-testid='icon-refresh' />,
  Search: () => <span data-testid='icon-search' />,
}));

import ProjectSkillMarketModal, {
  clearProjectSkillMarketCacheForTests,
} from '@/renderer/pages/conversation/ProjectSkillMarketModal';

describe('ProjectSkillMarketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    translationMockState.unstableIdentity = false;
    messageApiMock.success.mockReset();
    messageApiMock.error.mockReset();
    messageApiMock.warning.mockReset();
    clearProjectSkillMarketCacheForTests();
    getProjectCapabilitySnapshotInvokeMock.mockResolvedValue(undefined);
    searchSkillMarketInvokeMock.mockResolvedValue({
      success: true,
      data: {
        brandName: 'ContextGo',
        total: 1,
        siteUrl: 'https://www.skillmarket.com.cn',
        industryIndex: [
          {
            id: 'design',
            label: 'Design',
            summary: 'Design workflow skills',
            problems: [],
            useCases: [],
            outcomes: [],
            workflow: [],
            count: 1,
            topThemes: [],
            bundleIds: ['design-starter'],
            recommendedSkills: [],
          },
        ],
        bundles: [
          {
            id: 'design-starter',
            title: 'Design Starter',
            summary: 'A focused set of skills for design delivery.',
            industries: ['Design'],
            forTeams: 'Design teams',
            deliverables: [],
            valuePoints: [],
            steps: [
              {
                label: 'Prepare',
                themes: ['delivery'],
                skillIds: ['bundle-skill::1.0.0::tester'],
                skills: [],
              },
            ],
            skills: [
              {
                id: 'bundle-skill::1.0.0::tester',
                name: 'bundle-skill',
                displayName: 'Bundle Skill',
                version: '1.0.0',
                author: 'tester',
                description: 'A skill included through a scenario bundle.',
                categories: [],
                tags: [],
                themes: ['delivery'],
                industries: ['Design'],
                archives: [
                  {
                    source: 'skillhub',
                    relativePath: 'bundle-skill/1.0.0.zip',
                    label: 'Default package',
                  },
                ],
                popularity: 5,
                qualityScore: 8.2,
                installs: 2,
                stars: 1,
              },
            ],
          },
        ],
        items: [
          {
            id: 'market-skill::1.0.0::tester',
            name: 'market-skill',
            displayName: 'Market Skill',
            version: '1.0.0',
            author: 'tester',
            description: 'Project-ready skill from the public catalog.',
            categories: [],
            tags: [],
            themes: ['delivery'],
            industries: [],
            archives: [
              {
                source: 'skillhub',
                relativePath: 'market-skill/1.0.0.zip',
                label: 'Default package',
              },
            ],
            popularity: 10,
            qualityScore: 8.8,
            installs: 5,
            stars: 2,
          },
        ],
      },
    });
    listAvailableSkillsInvokeMock.mockResolvedValue([]);
    installSkillMarketSkillToWorkspaceInvokeMock.mockResolvedValue({
      success: true,
      data: {
        skillName: 'market-skill',
        installedPath: '/tmp/workspace/.contextgo/skills/market-skill',
        archiveUrl: 'https://www.skillmarket.com.cn/packages/market-skill.zip',
      },
      msg: 'Skill "market-skill" installed to workspace: /tmp/workspace/.contextgo/skills/market-skill',
    });
  });

  it('loads remote market results for the current workspace', async () => {
    render(<ProjectSkillMarketModal visible={true} workspacePath='/tmp/workspace' onClose={() => undefined} />);

    await waitFor(() => {
      expect(searchSkillMarketInvokeMock).toHaveBeenCalledWith({
        query: '',
        limit: 12,
        offset: 0,
        forceRefresh: false,
        view: 'curated',
      });
    });

    expect(await screen.findByText('Market Skill')).toBeInTheDocument();
    expect(screen.getByText(/\/tmp\/workspace\/\.contextgo\/skills/)).toBeInTheDocument();
  });

  it('uses project path and capability signals for the default recommendations', async () => {
    getProjectCapabilitySnapshotInvokeMock.mockResolvedValue({
      workspacePath: '/Users/me/design-system',
      automationRootRelativePath: '.contextgo',
      counts: { skill: 1, hook: 0, command: 0, schedule: 0 },
      skills: [
        {
          kind: 'skill',
          id: 'figma-export',
          name: 'figma-export',
          description: 'Export Figma assets for frontend implementation',
          docKey: 'skill:figma-export',
          workspaceRelativePath: '.contextgo/skills/figma-export/SKILL.md',
          skillDocumentRelativePath: '.contextgo/skills/figma-export/SKILL.md',
          compatibility: [],
          dependencyHints: [],
          implicitInvocation: false,
          openAIDisplayName: 'Figma Export',
          openAIShortDescription: 'Prepare design assets for implementation',
        },
      ],
      hooks: [],
      commands: [],
      schedules: [],
    });

    render(
      <ProjectSkillMarketModal visible={true} workspacePath='/Users/me/design-system' onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(searchSkillMarketInvokeMock).toHaveBeenCalledWith({
        query: 'design system figma export prepare assets implementation',
        limit: 12,
        offset: 0,
        forceRefresh: false,
        view: 'curated',
      });
    });

    expect(
      await screen.findByText('Project signals: design system figma export prepare assets implementation')
    ).toBeInTheDocument();
  });

  it('falls back to curated skills when project recommendations are too narrow', async () => {
    getProjectCapabilitySnapshotInvokeMock.mockResolvedValue({
      workspacePath: '/Users/me/contextgo-master',
      automationRootRelativePath: '.contextgo',
      counts: { skill: 0, hook: 0, command: 0, schedule: 0 },
      skills: [],
      hooks: [],
      commands: [],
      schedules: [],
    });
    searchSkillMarketInvokeMock.mockImplementation(async (params: { query?: string }) => {
      if (params.query?.trim()) {
        return {
          success: true,
          data: {
            brandName: 'ContextGo',
            total: 0,
            totalAvailable: 3043,
            siteUrl: 'https://www.skillmarket.com.cn',
            industryIndex: [],
            bundles: [],
            items: [],
          },
        };
      }

      return {
        success: true,
        data: {
          brandName: 'ContextGo',
          total: 1,
          totalAvailable: 3043,
          siteUrl: 'https://www.skillmarket.com.cn',
          industryIndex: [],
          bundles: [],
          items: [
            {
              id: 'market-skill::1.0.0::tester',
              name: 'market-skill',
              displayName: 'Market Skill',
              version: '1.0.0',
              author: 'tester',
              description: 'Project-ready skill from the public catalog.',
              categories: [],
              tags: [],
              themes: ['delivery'],
              industries: [],
              archives: [],
              popularity: 10,
              qualityScore: 8.8,
              installs: 5,
              stars: 2,
            },
          ],
        },
      };
    });

    render(
      <ProjectSkillMarketModal visible={true} workspacePath='/Users/me/contextgo-master' onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(searchSkillMarketInvokeMock).toHaveBeenCalledWith({
        query: 'contextgo master',
        limit: 12,
        offset: 0,
        forceRefresh: false,
        view: 'curated',
      });
    });
    await waitFor(() => {
      expect(searchSkillMarketInvokeMock).toHaveBeenCalledWith({
        query: '',
        limit: 12,
        offset: 0,
        forceRefresh: false,
        view: 'curated',
      });
    });
    expect(await screen.findByText('Market Skill')).toBeInTheDocument();
  });

  it('reuses cached market results when the same project opens again', async () => {
    const { unmount } = render(
      <ProjectSkillMarketModal visible={true} workspacePath='/Users/me/design-system' onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(screen.getByText('Market Skill')).toBeInTheDocument();
    });
    expect(searchSkillMarketInvokeMock).toHaveBeenCalledTimes(1);

    unmount();
    render(
      <ProjectSkillMarketModal visible={true} workspacePath='/Users/me/design-system' onClose={() => undefined} />
    );

    await waitFor(() => {
      expect(screen.getByText('Market Skill')).toBeInTheDocument();
    });
    expect(searchSkillMarketInvokeMock).toHaveBeenCalledTimes(1);
  });

  it('filters market results by industry without changing the market catalog rules', async () => {
    render(<ProjectSkillMarketModal visible={true} workspacePath='/tmp/workspace' onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Design (1)' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Design (1)' }));

    await waitFor(() => {
      expect(searchSkillMarketInvokeMock).toHaveBeenLastCalledWith({
        query: '',
        limit: 12,
        offset: 0,
        forceRefresh: false,
        view: 'curated',
        industryId: 'design',
      });
    });
  });

  it('installs a remote skill into the workspace and refreshes installed skill state', async () => {
    installSkillMarketSkillToWorkspaceInvokeMock.mockImplementation(async () => {
      listAvailableSkillsInvokeMock.mockResolvedValue([
        {
          name: 'market-skill',
          description: 'Project-ready skill from the public catalog.',
          location: '/tmp/workspace/.contextgo/skills/market-skill/SKILL.md',
          isCustom: true,
        },
      ]);

      return {
        success: true,
        data: {
          skillName: 'market-skill',
          installedPath: '/tmp/workspace/.contextgo/skills/market-skill',
          archiveUrl: 'https://www.skillmarket.com.cn/packages/market-skill.zip',
        },
        msg: 'Skill "market-skill" installed to workspace: /tmp/workspace/.contextgo/skills/market-skill',
      };
    });

    render(<ProjectSkillMarketModal visible={true} workspacePath='/tmp/workspace' onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('Market Skill')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add to Project' }));

    await waitFor(() => {
      expect(installSkillMarketSkillToWorkspaceInvokeMock).toHaveBeenCalledWith({
        workspacePath: '/tmp/workspace',
        skillId: 'market-skill::1.0.0::tester',
        archive: {
          source: 'skillhub',
          relativePath: 'market-skill/1.0.0.zip',
          label: 'Default package',
        },
      });
    });

    await waitFor(() => {
      expect(listAvailableSkillsInvokeMock).toHaveBeenCalledTimes(2);
      expect(screen.getAllByText('Installed').length).toBeGreaterThan(0);
    });
  });

  it('installs a scenario bundle into the workspace skill directory', async () => {
    render(<ProjectSkillMarketModal visible={true} workspacePath='/tmp/workspace' onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('Design Starter')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add Bundle' }));

    await waitFor(() => {
      expect(installSkillMarketSkillToWorkspaceInvokeMock).toHaveBeenCalledWith({
        workspacePath: '/tmp/workspace',
        skillId: 'bundle-skill::1.0.0::tester',
        archive: {
          source: 'skillhub',
          relativePath: 'bundle-skill/1.0.0.zip',
          label: 'Default package',
        },
      });
    });
  });

  it('does not repeatedly reload when translation hook identity changes across renders', async () => {
    translationMockState.unstableIdentity = true;

    render(<ProjectSkillMarketModal visible={true} workspacePath='/tmp/workspace' onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('Market Skill')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(searchSkillMarketInvokeMock).toHaveBeenCalledTimes(1);
    });
  });

  it('supports embedded rendering inside the automation skills tab', async () => {
    render(
      <ProjectSkillMarketModal
        visible={true}
        workspacePath='/tmp/workspace'
        variant='embedded'
        onClose={() => undefined}
      />
    );

    await waitFor(() => {
      expect(searchSkillMarketInvokeMock).toHaveBeenCalledWith({
        query: '',
        limit: 12,
        offset: 0,
        forceRefresh: false,
        view: 'curated',
      });
    });

    expect(await screen.findByText('Market Skill')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-sub-modal')).not.toBeInTheDocument();
  });
});
