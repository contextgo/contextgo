/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManagedCommandLibraryEditor from '@/renderer/pages/settings/ToolsSettings/ManagedCommandLibraryEditor';

const successMessageMock = vi.fn();
const errorMessageMock = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key),
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/renderer/components/automation', () => ({
  AutomationPanel: ({
    title,
    description,
    meta,
    actions,
    children,
  }: {
    title: React.ReactNode;
    description?: React.ReactNode;
    meta?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
  }) => (
    <section>
      <div>{title}</div>
      {description ? <div>{description}</div> : null}
      {meta ? <div>{meta}</div> : null}
      {actions ? <div>{actions}</div> : null}
      <div>{children}</div>
    </section>
  ),
  AutomationSectionCard: ({
    title,
    description,
    children,
  }: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <section>
      {title ? <h2>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
      <div>{children}</div>
    </section>
  ),
}));

vi.mock('@/renderer/components/settings', () => ({
  SettingsSubModal: ({ children, visible }: { children?: React.ReactNode; visible?: boolean }) =>
    visible ? <div>{children}</div> : null,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    icon,
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    icon?: React.ReactNode;
  }) => (
    <button type='button' onClick={onClick}>
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
      <div key='message-context' />,
    ],
  },
  Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
    <input type='checkbox' checked={checked} onChange={(event) => onChange?.(event.target.checked)} />
  ),
  Typography: {
    Paragraph: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Title: ({ children }: { children?: React.ReactNode }) => <h2>{children}</h2>,
  },
}));

vi.mock('@icon-park/react', () => ({
  Command: () => <span>command-icon</span>,
  Delete: () => <span>delete-icon</span>,
  Edit: () => <span>edit-icon</span>,
  Plus: () => <span>plus-icon</span>,
  Refresh: () => <span>refresh-icon</span>,
}));

describe('ManagedCommandLibraryEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a single project command list without builtin or custom labels', async () => {
    render(
      <ManagedCommandLibraryEditor
        title='Commands'
        description='Manage workspace commands'
        loadLibrary={vi.fn().mockResolvedValue([
          {
            id: 'project-plan',
            enabled: true,
            name: 'plan',
            description: 'Plan the work first',
            template: 'Write the plan before coding.',
          },
        ])}
        saveLibrary={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('/plan')).toBeInTheDocument();
    });

    expect(screen.queryByText('settings.commands.recommendedTitle')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.commands.recommendedDescription')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.commands.customTitle')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.commands.builtinTag')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.commands.customTag')).not.toBeInTheDocument();
  });

  it('shows an empty project command state when loading fails', async () => {
    render(
      <ManagedCommandLibraryEditor
        title='Commands'
        description='Manage workspace commands'
        loadLibrary={vi.fn().mockRejectedValue(new Error('load failed'))}
        saveLibrary={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() => {
      expect(errorMessageMock).toHaveBeenCalledWith('settings.commands.loadFailed');
    });

    expect(screen.queryByText('/plan')).not.toBeInTheDocument();
    expect(screen.getByText('settings.commands.emptyCustom')).toBeInTheDocument();
  });

  it('loads the command library once on mount instead of reloading on its own rerenders', async () => {
    const loadLibrary = vi.fn().mockResolvedValue([
      {
        id: 'project-plan',
        enabled: true,
        name: 'plan',
        description: 'Plan the work first',
        template: 'Write the plan before coding.',
      },
    ]);

    render(
      <ManagedCommandLibraryEditor
        title='Commands'
        description='Manage workspace commands'
        loadLibrary={loadLibrary}
        saveLibrary={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('/plan')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(loadLibrary).toHaveBeenCalled();
    });

    expect(loadLibrary).toHaveBeenCalledTimes(1);
  });
});
