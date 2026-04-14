import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    icon,
    disabled,
    title,
  }: {
    children?: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    title?: string;
  }) => (
    <button type='button' onClick={(event) => onClick?.(event)} disabled={disabled} title={title}>
      {icon}
      {children}
    </button>
  ),
  Input: ({
    value,
    placeholder,
    onChange,
    prefix,
  }: {
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
    prefix?: React.ReactNode;
  }) => (
    <label>
      {prefix}
      <input value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  ),
  Dropdown: ({ children, droplist }: { children?: React.ReactNode; droplist?: React.ReactNode }) => (
    <>
      {children}
      {droplist}
    </>
  ),
  Menu: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
    Item: ({
      children,
      onClick,
    }: {
      children?: React.ReactNode;
      onClick?: (event: { stopPropagation: () => void }) => void;
    }) => (
      <button type='button' onClick={() => onClick?.({ stopPropagation: () => undefined })}>
        {children}
      </button>
    ),
    ItemGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    SubMenu: ({ title, children }: { title?: React.ReactNode; children?: React.ReactNode }) => (
      <div>
        <div>{title}</div>
        <div>{children}</div>
      </div>
    ),
  }),
  Message: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(() => vi.fn()),
  },
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
}));

vi.mock('@icon-park/react', () => ({
  Delete: () => <span data-testid='icon-delete' />,
  FolderOpen: () => <span data-testid='icon-folder' />,
  Info: () => <span data-testid='icon-info' />,
  Search: () => <span data-testid='icon-search' />,
  Plus: () => <span data-testid='icon-plus' />,
  Refresh: () => <span data-testid='icon-refresh' />,
  Close: () => <span data-testid='icon-close' />,
}));

const mockListAvailableSkills = vi.fn();
const mockDetectAndCountExternalSkills = vi.fn();
const mockGetSkillPaths = vi.fn();
const mockImportSkillWithSymlink = vi.fn();
const mockDeleteSkill = vi.fn();
const mockExportSkillWithSymlink = vi.fn();
const mockAddCustomExternalPath = vi.fn();
const mockReadSkillContent = vi.fn();
const mockShowOpen = vi.fn();
const mockSearchSkillMarket = vi.fn();
const mockInstallSkillMarketSkill = vi.fn();
const mockOpenExternal = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      listAvailableSkills: { invoke: (...args: unknown[]) => mockListAvailableSkills(...args) },
      detectAndCountExternalSkills: { invoke: (...args: unknown[]) => mockDetectAndCountExternalSkills(...args) },
      getSkillPaths: { invoke: (...args: unknown[]) => mockGetSkillPaths(...args) },
      importSkillWithSymlink: { invoke: (...args: unknown[]) => mockImportSkillWithSymlink(...args) },
      deleteSkill: { invoke: (...args: unknown[]) => mockDeleteSkill(...args) },
      exportSkillWithSymlink: { invoke: (...args: unknown[]) => mockExportSkillWithSymlink(...args) },
      addCustomExternalPath: { invoke: (...args: unknown[]) => mockAddCustomExternalPath(...args) },
      readSkillContent: { invoke: (...args: unknown[]) => mockReadSkillContent(...args) },
      searchSkillMarket: { invoke: (...args: unknown[]) => mockSearchSkillMarket(...args) },
      installSkillMarketSkill: { invoke: (...args: unknown[]) => mockInstallSkillMarketSkill(...args) },
    },
    dialog: {
      showOpen: { invoke: (...args: unknown[]) => mockShowOpen(...args) },
    },
    shell: {
      openExternal: { invoke: (...args: unknown[]) => mockOpenExternal(...args) },
    },
  },
}));

vi.mock('@/renderer/components/base', () => ({
  ContextGoModal: ({
    visible,
    header,
    footer,
    children,
  }: {
    visible?: boolean;
    header?: React.ReactNode | { title?: React.ReactNode };
    footer?: React.ReactNode | { render?: () => React.ReactNode };
    children?: React.ReactNode;
  }) => {
    if (!visible) {
      return null;
    }

    const headerTitle = typeof header === 'object' && header !== null && 'title' in header ? header.title : header;
    const footerNode = typeof footer === 'object' && footer !== null && 'render' in footer ? footer.render?.() : footer;

    return (
      <div data-testid='mock-modal'>
        <h2>{headerTitle}</h2>
        <div>{children}</div>
        <div>{footerNode}</div>
      </div>
    );
  },
}));

vi.mock('@/renderer/components/Markdown', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid='mock-markdown'>{children}</div>,
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid='settings-page-wrapper'>{children}</div>,
}));

import SkillsHubSettings from '@/renderer/pages/settings/SkillsHubSettings';

describe('SkillsHubSettings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockListAvailableSkills.mockResolvedValue([
      { name: 'MySkill1', description: 'desc1', location: '/path1', isCustom: true },
      { name: 'Builtin1', description: 'desc2', location: '/path2', isCustom: false },
      {
        name: 'HarnessSkill',
        description: 'hidden pack skill',
        location: '/path3',
        isCustom: false,
        hiddenFromSkillsLibrary: true,
        packageOwnerPresetIds: ['superpowers'],
      },
    ]);

    mockDetectAndCountExternalSkills.mockResolvedValue({
      success: true,
      data: [
        {
          name: 'Gemini CLI',
          source: 'gemini',
          path: '/home/gemini',
          skills: [
            { name: 'ExtSkill1', description: 'extdesc1', path: '/home/gemini/ext1' },
            { name: 'ExtSkill2', description: 'extdesc2', path: '/home/gemini/ext2' },
          ],
        },
      ],
    });

    mockGetSkillPaths.mockResolvedValue({
      userSkillsDir: '/user/skills',
      builtinSkillsDir: '/builtin/skills',
    });

    mockSearchSkillMarket.mockResolvedValue({
      success: true,
      data: {
        items: [],
        total: 0,
        totalAvailable: 0,
        brandName: 'ContextGo',
        siteUrl: 'https://www.skillmarket.com.cn',
        stats: null,
        industryIndex: [],
        bundles: [],
      },
    });
  });

  it('should render main sections and load skills', async () => {
    render(<SkillsHubSettings />);

    await waitFor(() => {
      expect(mockListAvailableSkills).toHaveBeenCalled();
      expect(mockDetectAndCountExternalSkills).toHaveBeenCalled();
    });

    expect(screen.getByText('Discovered External Skills')).toBeInTheDocument();
    expect(screen.getByText('My Skills')).toBeInTheDocument();
    expect(screen.getAllByText('Gemini CLI').length).toBeGreaterThan(0);
    expect(screen.getByText('ExtSkill1')).toBeInTheDocument();
    expect(screen.getByText('MySkill1')).toBeInTheDocument();
    expect(screen.getByText('Builtin1')).toBeInTheDocument();
    expect(screen.queryByText('HarnessSkill')).not.toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Built-in')).toBeInTheDocument();
    expect(screen.getByText('/user/skills')).toBeInTheDocument();
    expect(
      screen.getByText(
        '{{count}} built-in packaged skills are attached to preset assistants and are hidden from the standalone skill library.'
      )
    ).toBeInTheDocument();
  });

  it('should fetch local skills only once when stabilizing the active source tab', async () => {
    render(<SkillsHubSettings />);

    await waitFor(() => {
      expect(screen.getByText('MySkill1')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockListAvailableSkills).toHaveBeenCalledTimes(1);
      expect(mockDetectAndCountExternalSkills).toHaveBeenCalledTimes(1);
      expect(mockGetSkillPaths).toHaveBeenCalledTimes(1);
    });
  });

  it('should filter skills correctly by search query', async () => {
    render(<SkillsHubSettings />);

    await waitFor(() => {
      expect(screen.getByText('MySkill1')).toBeInTheDocument();
    });

    const searchInputs = screen.getAllByPlaceholderText('Search skills...');
    const mySkillsSearch = searchInputs[1];

    fireEvent.change(mySkillsSearch, { target: { value: 'NotFound' } });

    await waitFor(() => {
      expect(screen.queryByText('MySkill1')).not.toBeInTheDocument();
      expect(screen.queryByText('Builtin1')).not.toBeInTheDocument();
    });

    fireEvent.change(mySkillsSearch, { target: { value: 'builtin' } });

    await waitFor(() => {
      expect(screen.queryByText('MySkill1')).not.toBeInTheDocument();
      expect(screen.getByText('Builtin1')).toBeInTheDocument();
      expect(screen.queryByText('HarnessSkill')).not.toBeInTheDocument();
    });
  });

  it('should render display metadata and preview SKILL.md content', async () => {
    mockListAvailableSkills.mockResolvedValue([
      {
        name: 'release-guard',
        description: 'fallback description',
        location: '/skills/release-guard/SKILL.md',
        isCustom: true,
        openAIConfig: {
          interface: {
            displayName: 'Release Guard',
            shortDescription: 'Keep release work narrow.',
          },
        },
      },
    ]);
    mockReadSkillContent.mockResolvedValue({
      success: true,
      data: {
        content: `---
name: release-guard
description: fallback description
---

# Release Guard

Use this skill to keep release changes narrow.
`,
      },
    });

    render(<SkillsHubSettings />);

    await waitFor(() => {
      expect(screen.getByText('Release Guard')).toBeInTheDocument();
      expect(screen.getByText('Keep release work narrow.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Preview'));

    await waitFor(() => {
      expect(mockReadSkillContent).toHaveBeenCalledWith({ skillPath: '/skills/release-guard/SKILL.md' });
    });

    const modal = await screen.findByTestId('mock-modal');
    expect(within(modal).getByText('/skills/release-guard/SKILL.md')).toBeInTheDocument();
    expect(within(modal).getByText(/Use this skill to keep release changes narrow./)).toBeInTheDocument();
    expect(within(modal).queryByText('name: release-guard')).not.toBeInTheDocument();
    expect(within(modal).queryByText('description: fallback description')).not.toBeInTheDocument();
  });

  it('should import external skill successfully', async () => {
    mockImportSkillWithSymlink.mockResolvedValue({ success: true });

    render(<SkillsHubSettings />);

    await waitFor(() => {
      expect(screen.getByText('ExtSkill1')).toBeInTheDocument();
    });

    const importButtons = screen.getAllByText('Import');
    fireEvent.click(importButtons[0]);

    await waitFor(() => {
      expect(mockImportSkillWithSymlink).toHaveBeenCalledWith({ skillPath: '/home/gemini/ext1' });
    });
  });

  it('should call delete endpoint after confirming custom skill deletion', async () => {
    mockListAvailableSkills.mockResolvedValue([
      { name: 'MySkill1', description: 'desc1', location: '/path1', isCustom: true },
    ]);
    mockDeleteSkill.mockResolvedValue({ success: true });

    render(<SkillsHubSettings />);

    await waitFor(() => {
      expect(screen.getByText('MySkill1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(screen.getByText('Delete Skill')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockDeleteSkill).toHaveBeenCalledWith({ skillName: 'MySkill1' });
    });
  });

  it('should be able to add a custom external path', async () => {
    mockAddCustomExternalPath.mockResolvedValue({ success: true });

    render(<SkillsHubSettings />);

    await waitFor(() => {
      expect(screen.getByText('Discovered External Skills')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('icon-plus').parentElement!);

    const nameInput = await screen.findByPlaceholderText('e.g. My Custom Skills');
    const textboxes = screen.getAllByRole('textbox');
    const pathInput = textboxes[textboxes.length - 1];

    fireEvent.change(nameInput, { target: { value: 'NewPath' } });
    fireEvent.change(pathInput, { target: { value: '/foo/bar' } });

    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(mockAddCustomExternalPath).toHaveBeenCalledWith({ name: 'NewPath', path: '/foo/bar' });
    });
  });

  it('should render usage tips correctly', async () => {
    render(<SkillsHubSettings />);
    expect(await screen.findByText('Usage Tip:')).toBeInTheDocument();
  });
});
