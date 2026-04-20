import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import WorkspaceToolbar from '@/renderer/pages/conversation/Workspace/components/WorkspaceToolbar';

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    type,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    type?: string;
    [key: string]: unknown;
  }) => (
    <button type='button' data-kind={type} onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Dropdown: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Input: ({
    value,
    onChange,
    ...props
  }: {
    value?: string;
    onChange?: (value: string) => void;
    [key: string]: unknown;
  }) => <input value={value} onChange={(event) => onChange?.(event.target.value)} {...props} />,
  Menu: Object.assign(({ children }: { children?: React.ReactNode }) => <div>{children}</div>, {
    Item: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  }),
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

describe('WorkspaceToolbar', () => {
  const createProps = () => ({
    currentView: 'files' as const,
    onViewChange: vi.fn(),
    t: (key: string) => key,
    isWorkspaceCollapsed: false,
    setIsWorkspaceCollapsed: vi.fn(),
    isTemporaryWorkspace: false,
    workspacePath: '/workspace',
    workspaceDisplayName: 'workspace',
    showSearch: true,
    searchText: '',
    setSearchText: vi.fn(),
    onSearch: vi.fn(),
    searchInputRef: { current: null },
    loading: false,
    refreshWorkspace: vi.fn(),
    handleSelectHostFiles: vi.fn(),
    handleUploadDeviceFiles: vi.fn(),
    setShowHostFileSelector: vi.fn(),
    handleOpenMigrationModal: vi.fn(),
    handleOpenWorkspaceRoot: vi.fn(async () => {}),
  });

  it('opens the changes view from the search row icon', () => {
    const props = createProps();

    render(<WorkspaceToolbar {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'conversation.workspace.viewChanges' }));

    expect(props.onViewChange).toHaveBeenCalledWith('changes');
  });

  it('shows a back-to-files icon when the changes view is active', () => {
    const props = createProps();

    render(<WorkspaceToolbar {...props} currentView='changes' showSearch={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'conversation.workspace.viewFiles' }));

    expect(props.onViewChange).toHaveBeenCalledWith('files');
  });
});
