import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getWorkspaceGitChangesInvokeMock = vi.fn();
const getWorkspaceGitDiffInvokeMock = vi.fn();
const getWorkspaceRecentFilesInvokeMock = vi.fn();
const getImageBase64InvokeMock = vi.fn();
const readFileInvokeMock = vi.fn();
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
      getWorkspaceRecentFiles: {
        invoke: (...args: unknown[]) => getWorkspaceRecentFilesInvokeMock(...args),
      },
      getImageBase64: {
        invoke: (...args: unknown[]) => getImageBase64InvokeMock(...args),
      },
      readFile: {
        invoke: (...args: unknown[]) => readFileInvokeMock(...args),
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
    getWorkspaceRecentFilesInvokeMock.mockResolvedValue({
      success: true,
      data: {
        files: [],
      },
    });
    getImageBase64InvokeMock.mockResolvedValue('data:image/png;base64,abc');
    readFileInvokeMock.mockResolvedValue('## Notes');
  });

  it('loads workspace changes and opens diff preview for a selected file', async () => {
    render(<WorkspaceChanges workspace='/repo' reloadToken={0} openPreview={openPreviewMock} />);

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

  it('reloads the changes surface when the shared workspace refresh token changes', async () => {
    const { rerender } = render(<WorkspaceChanges workspace='/repo' reloadToken={0} openPreview={openPreviewMock} />);

    expect(await screen.findByText('src/app.ts')).toBeInTheDocument();

    getWorkspaceGitChangesInvokeMock.mockResolvedValueOnce({
      success: true,
      data: {
        repository: {
          isRepository: true,
          repositoryRoot: '/repo',
          branch: 'main',
        },
        changes: [
          {
            path: 'src/next.ts',
            absolutePath: '/repo/src/next.ts',
            status: 'A',
          },
        ],
      },
    });

    rerender(<WorkspaceChanges workspace='/repo' reloadToken={1} openPreview={openPreviewMock} />);

    expect(await screen.findByText('src/next.ts')).toBeInTheDocument();
    expect(getWorkspaceGitChangesInvokeMock).toHaveBeenCalledTimes(2);
  });

  it('shows recent files for a non-git workspace and opens file preview', async () => {
    getWorkspaceGitChangesInvokeMock.mockResolvedValue({
      success: true,
      data: {
        repository: null,
        changes: [],
      },
    });
    getWorkspaceRecentFilesInvokeMock.mockResolvedValue({
      success: true,
      data: {
        files: [
          {
            path: 'docs/notes.md',
            absolutePath: '/workspace/docs/notes.md',
            lastModified: 1713510000000,
            size: 128,
          },
        ],
      },
    });
    readFileInvokeMock.mockResolvedValue('# Notes');

    render(<WorkspaceChanges workspace='/workspace' reloadToken={0} openPreview={openPreviewMock} />);

    expect(await screen.findByText('docs/notes.md')).toBeInTheDocument();
    expect(screen.getByText('conversation.workspace.changesRecentFallback')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'docs/notes.md' }));

    await waitFor(() => {
      expect(getWorkspaceRecentFilesInvokeMock).toHaveBeenCalledWith({
        path: '/workspace',
      });
      expect(readFileInvokeMock).toHaveBeenCalledWith({
        path: '/workspace/docs/notes.md',
      });
      expect(openPreviewMock).toHaveBeenCalledWith(
        '# Notes',
        'markdown',
        expect.objectContaining({
          title: 'docs/notes.md',
          fileName: 'notes.md',
          filePath: '/workspace/docs/notes.md',
          workspace: '/workspace',
          editable: false,
        })
      );
    });
  });
});
