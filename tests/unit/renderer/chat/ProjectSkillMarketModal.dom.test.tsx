import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const searchSkillMarketInvokeMock = vi.fn();
const installSkillMarketSkillToWorkspaceInvokeMock = vi.fn();
const listAvailableSkillsInvokeMock = vi.fn();
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

import ProjectSkillMarketModal from '@/renderer/pages/conversation/ProjectSkillMarketModal';

describe('ProjectSkillMarketModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    translationMockState.unstableIdentity = false;
    messageApiMock.success.mockReset();
    messageApiMock.error.mockReset();
    messageApiMock.warning.mockReset();
    searchSkillMarketInvokeMock.mockResolvedValue({
      success: true,
      data: {
        brandName: 'ContextGo',
        total: 1,
        siteUrl: 'https://www.skillmarket.com.cn',
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
});
