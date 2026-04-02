import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const hoistedConfigMocks = vi.hoisted(() => ({
  getConfigMock: vi.fn(),
  setConfigMock: vi.fn().mockResolvedValue(undefined),
}));

const getConfigMock = hoistedConfigMocks.getConfigMock;
const setConfigMock = hoistedConfigMocks.setConfigMock;
const emitMock = vi.fn();
const successMessageMock = vi.fn();
const errorMessageMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
    t: (key: string, options?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'common.loading': 'Loading',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
        'common.confirmDelete': 'Confirm Delete',
        'common.saveSuccess': 'Saved successfully',
        'common.createSuccess': 'Created successfully',
        'common.deleteSuccess': 'Deleted successfully',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'settings.commands.title': 'Commands',
        'settings.commands.description': 'Manage reusable slash commands.',
        'settings.commands.usageHint': 'Type / in chat.',
        'settings.commands.add': 'Add Command',
        'settings.commands.restoreDefaults': 'Restore Defaults',
        'settings.commands.restoreSuccess': 'Default commands restored',
        'settings.commands.restoreFailed': 'Failed to restore default commands',
        'settings.commands.recommendedTitle': 'Recommended Workflow Commands',
        'settings.commands.recommendedDescription': 'Builtin workflow shortcuts.',
        'settings.commands.customTitle': 'Custom Commands',
        'settings.commands.customDescription': 'Add reusable workflow prompts.',
        'settings.commands.emptyCustom': 'No custom commands yet.',
        'settings.commands.builtinTag': 'Built-in',
        'settings.commands.customTag': 'Custom',
        'settings.commands.templateLabel': 'Template',
        'settings.commands.createTitle': 'Create Command',
        'settings.commands.editTitle': `Edit Command ${options?.name ?? ''}`,
        'settings.commands.nameLabel': 'Command Name',
        'settings.commands.namePlaceholder': 'Use letters, numbers, hyphen, or underscore',
        'settings.commands.descriptionLabel': 'Description',
        'settings.commands.descriptionPlaceholder': 'Explain when this command should be used',
        'settings.commands.templatePlaceholder': 'Enter prompt template',
        'settings.commands.builtinOverrideHint': `${options?.name ?? ''} is built-in.`,
        'settings.commands.loadFailed': 'Failed to load command library',
        'settings.commands.saveFailed': 'Failed to save command',
        'settings.commands.deleteFailed': 'Failed to delete command',
        'settings.commands.deleteConfirm': 'Delete this custom command?',
        'settings.commands.validation.invalidName': 'Invalid name',
        'settings.commands.validation.duplicateName': `Duplicate ${options?.name ?? ''}`,
        'settings.commands.validation.descriptionRequired': 'Description required',
        'settings.commands.validation.templateRequired': 'Template required',
        'settings.commands.presets.plan.description': 'Plan before coding',
        'settings.commands.presets.plan.template': 'Restate the task before coding.',
        'settings.commands.presets.tdd.description': 'Use tests first',
        'settings.commands.presets.tdd.template': 'Write tests before implementation.',
        'settings.commands.presets.codeReview.description': 'Review current changes',
        'settings.commands.presets.codeReview.template': 'Review current changes strictly.',
        'settings.commands.presets.security.description': 'Security review',
        'settings.commands.presets.security.template': 'Review auth, secrets, and injections.',
        'settings.commands.presets.verify.description': 'Verify current implementation',
        'settings.commands.presets.verify.template': 'Verify behavior and release readiness.',
        'settings.commands.presets.orchestrate.description': 'Coordinate multiple streams',
        'settings.commands.presets.orchestrate.template': 'Break task into coordinated streams.',
      };

      return map[key] ?? (options?.defaultValue as string) ?? key;
    },
  }),
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    get: (...args: unknown[]) => getConfigMock(...args),
    set: (...args: unknown[]) => setConfigMock(...args),
  },
}));

vi.mock('@/common/utils', () => ({
  uuid: () => 'generated-command-id',
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
      <div data-testid='mock-contextgo-modal'>
        <div>{headerTitle}</div>
        <div>{children}</div>
        <div>{footerNode}</div>
      </div>
    );
  },
}));

vi.mock('@/renderer/utils/emitter', () => ({
  emitter: {
    emit: (...args: unknown[]) => emitMock(...args),
  },
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='settings-page-wrapper'>{children}</div>,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    icon,
    disabled,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button type='button' onClick={onClick} disabled={disabled}>
      {icon}
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Input: Object.assign(
    ({
      value,
      placeholder,
      onChange,
    }: {
      value?: string;
      placeholder?: string;
      onChange?: (value: string) => void;
      className?: string;
    }) => <input value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />,
    {
      TextArea: ({
        value,
        placeholder,
        onChange,
      }: {
        value?: string;
        placeholder?: string;
        onChange?: (value: string) => void;
      }) => <textarea value={value} placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />,
    }
  ),
  Message: {
    useMessage: () => [
      {
        success: successMessageMock,
        error: errorMessageMock,
      },
      <div key='message-holder' />,
    ],
  },
  Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (value: boolean) => void }) => (
    <button type='button' onClick={() => onChange?.(!checked)}>
      {checked ? 'on' : 'off'}
    </button>
  ),
  Tag: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Typography: {
    Title: ({ children }: { children: React.ReactNode }) => <h1>{children}</h1>,
    Paragraph: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children: React.ReactNode; bold?: boolean; type?: string }) => <span>{children}</span>,
  },
}));

vi.mock('@icon-park/react', () => ({
  Command: () => <span>command-icon</span>,
  Edit: () => <span>edit-icon</span>,
  Plus: () => <span>plus-icon</span>,
  Refresh: () => <span>refresh-icon</span>,
  Delete: () => <span>delete-icon</span>,
}));

import CommandSettings from '@/renderer/pages/settings/ToolsSettings/CommandSettings';

describe('CommandSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConfigMock.mockResolvedValue(undefined);
  });

  it('loads builtin commands and creates a custom command', async () => {
    render(<CommandSettings />);

    expect(await screen.findByText('Commands')).toBeInTheDocument();
    expect(screen.getByText('/plan')).toBeInTheDocument();
    expect(screen.getByText('/orchestrate')).toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Add Command')[0]);

    fireEvent.change(screen.getByPlaceholderText('Use letters, numbers, hyphen, or underscore'), {
      target: { value: 'ship-check' },
    });
    fireEvent.change(screen.getByPlaceholderText('Explain when this command should be used'), {
      target: { value: 'Verify release readiness' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter prompt template'), {
      target: { value: 'Check lint, tests, and release notes.' },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('ship-check')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Verify release readiness')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Check lint, tests, and release notes.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(setConfigMock).toHaveBeenCalledTimes(2);
    });

    const [, savedLibrary] = setConfigMock.mock.calls.at(-1) as [string, Array<Record<string, unknown>>];
    expect(savedLibrary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'custom',
          id: 'generated-command-id',
          name: 'ship-check',
          description: 'Verify release readiness',
          template: 'Check lint, tests, and release notes.',
        }),
      ])
    );
    expect(emitMock).toHaveBeenCalledWith('commands.library.updated');
  });
});
