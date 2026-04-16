import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWorkspaceGitChangesInvokeMock = vi.fn();
const getWorkspaceGitDiffInvokeMock = vi.fn();
const openPreviewMock = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      getWorkspaceGitChanges: {
        invoke: (...args: unknown[]) => getWorkspaceGitChangesInvokeMock(...args),
      },
      getWorkspaceGitDiff: {
        invoke: (...args: unknown[]) => getWorkspaceGitDiffInvokeMock(...args),
      },
    },
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button type='button' onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
  Spin: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Typography: {
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  },
}));

import WorkspaceChanges from '@/renderer/pages/conversation/Workspace/Changes';

describe('WorkspaceChanges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWorkspaceGitChangesInvokeMock.mockResolvedValue({
      success: true,
      data: {
        repository: {
          isRepository: true,
          repositoryRoot: '/repo',
          branch: 'main',
        },
        changes: [
          {
            path: 'src/app.ts',
            absolutePath: '/repo/src/app.ts',
            status: 'M',
          },
        ],
      },
    });
    getWorkspaceGitDiffInvokeMock.mockResolvedValue({
      success: true,
      data: {
        content: 'diff --git a/src/app.ts b/src/app.ts',
      },
    });
  });

  it('loads workspace changes and opens diff preview for a selected file', async () => {
    render(<WorkspaceChanges workspace='/repo' openPreview={openPreviewMock} />);

    expect(await screen.findByText('src/app.ts')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'src/app.ts' }));

    await waitFor(() => {
      expect(getWorkspaceGitDiffInvokeMock).toHaveBeenCalledWith({
        workspacePath: '/repo',
        filePath: '/repo/src/app.ts',
      });
      expect(openPreviewMock).toHaveBeenCalledWith(
        'diff --git a/src/app.ts b/src/app.ts',
        'diff',
        expect.objectContaining({
          fileName: 'src/app.ts',
          filePath: '/repo/src/app.ts',
          workspace: '/repo',
        })
      );
    });
  });
});
