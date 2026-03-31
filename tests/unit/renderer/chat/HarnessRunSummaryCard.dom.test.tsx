import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HarnessArtifactManifest } from '@/common/utils';

const { openPreviewMock, readFileInvokeMock } = vi.hoisted(() => ({
  openPreviewMock: vi.fn(),
  readFileInvokeMock: vi.fn(),
}));

const { openFileInvokeMock } = vi.hoisted(() => ({
  openFileInvokeMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { round?: number }) => {
      if (key === 'conversation.group.summary.title') {
        return 'Latest Harness Run';
      }
      if (key === 'conversation.group.summary.empty') {
        return 'No harness artifacts yet.';
      }
      if (key === 'conversation.group.summary.loading') {
        return 'Harness artifacts are being generated...';
      }
      if (key === 'conversation.group.summary.updatedAt') {
        return 'Updated';
      }
      if (key === 'conversation.group.summary.completedSteps') {
        return 'Completed Outputs';
      }
      if (key === 'conversation.group.summary.flow') {
        return 'Flow';
      }
      if (key === 'conversation.group.summary.latestStep') {
        return 'Latest Step';
      }
      if (key === 'conversation.group.summary.repository') {
        return 'Repository';
      }
      if (key === 'conversation.workspace.groupMembers.status.finished') {
        return 'Finished';
      }
      if (key === 'conversation.workspace.groupMembers.status.error') {
        return 'Error';
      }
      if (key === 'conversation.workspace.groupMembers.artifacts.planner') {
        return 'Planner';
      }
      if (key === 'conversation.workspace.groupMembers.artifacts.generator') {
        return 'Generator';
      }
      if (key === 'conversation.workspace.groupMembers.artifacts.evaluator') {
        return 'Evaluator';
      }
      if (key === 'conversation.workspace.groupMembers.artifacts.manifest') {
        return 'Manifest';
      }
      if (key === 'conversation.workspace.groupMembers.artifacts.folder') {
        return 'Open Folder';
      }
      if (key === 'conversation.group.modeDebate') {
        return 'Debate';
      }
      if (key === 'conversation.group.role.planner') {
        return 'Planner';
      }
      if (key === 'conversation.group.role.generator') {
        return 'Generator';
      }
      if (key === 'conversation.group.role.evaluator') {
        return 'Evaluator';
      }
      if (key === 'conversation.group.roundLabel') {
        return `Round ${options?.round ?? 0}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    fs: {
      readFile: {
        invoke: readFileInvokeMock,
      },
    },
    shell: {
      openFile: {
        invoke: openFileInvokeMock,
      },
    },
  },
}));

vi.mock('@/common/chat/chatLib', () => ({
  joinPath: (...parts: Array<string | undefined>) => parts.filter(Boolean).join('/'),
}));

vi.mock('@/renderer/pages/conversation/Preview', () => ({
  usePreviewContext: () => ({
    openPreview: openPreviewMock,
  }),
}));

import HarnessRunSummaryCard from '@/renderer/pages/conversation/platforms/group/HarnessRunSummaryCard';

const createManifest = (status: HarnessArtifactManifest['status']): HarnessArtifactManifest => ({
  version: 1,
  conversationId: 'group-1',
  collaborationMode: 'planner-generator-evaluator',
  orchestrationMode: 'debate',
  status,
  updatedAt: '2026-03-30T12:00:00.000Z',
  executionBoundary: {
    type: 'git-repository',
    repositoryRoot: '/workspace/repo',
    branch: 'main',
  },
  files: {
    request: '.contextgo/discussion-groups/group-1/latest/request.md',
    planner: '.contextgo/discussion-groups/group-1/latest/planner.md',
    generator: '.contextgo/discussion-groups/group-1/latest/generator.md',
    evaluator: '.contextgo/discussion-groups/group-1/latest/evaluator.md',
    manifest: '.contextgo/discussion-groups/group-1/latest/manifest.json',
  },
  rounds: [
    {
      round: 1,
      role: 'planner',
      participantId: 'planner-1',
      participantName: 'Planner Agent',
      updatedAt: '2026-03-30T12:01:00.000Z',
    },
    {
      round: 1,
      role: 'generator',
      participantId: 'generator-1',
      participantName: 'Generator Agent',
      updatedAt: '2026-03-30T12:02:00.000Z',
    },
  ],
});

describe('HarnessRunSummaryCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the latest harness manifest summary and previews artifacts', async () => {
    const manifest = createManifest('finished');

    readFileInvokeMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path.endsWith('manifest.json')) {
        return JSON.stringify(manifest);
      }
      if (path.endsWith('planner.md')) {
        return '# Planner Artifact';
      }
      return null;
    });

    render(
      <HarnessRunSummaryCard
        conversationId='group-1'
        workspace='/workspace'
        running={false}
        collaboration={{ mode: 'planner-generator-evaluator', executionBoundary: manifest.executionBoundary }}
        orchestration={{ mode: 'debate', rounds: 2 }}
      />
    );

    expect(screen.getByText('Latest Harness Run')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Finished')).toBeInTheDocument();
    });

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Debate · 2')).toBeInTheDocument();
    expect(screen.getByText('Round 1 · Generator · Generator Agent')).toBeInTheDocument();
    expect(screen.getByText('/workspace/repo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Planner' }));

    await waitFor(() => {
      expect(openPreviewMock).toHaveBeenCalledWith(
        '# Planner Artifact',
        'markdown',
        expect.objectContaining({
          title: 'planner.md',
          fileName: 'planner.md',
          filePath: '/workspace/.contextgo/discussion-groups/group-1/latest/planner.md',
          workspace: '/workspace',
          editable: false,
          language: 'markdown',
        })
      );
    });

    await userEvent.click(screen.getByRole('button', { name: 'Open Folder' }));

    await waitFor(() => {
      expect(openFileInvokeMock).toHaveBeenCalledWith('/workspace/.contextgo/discussion-groups/group-1/latest');
    });
  });

  it('shows the empty state when no harness manifest exists', async () => {
    readFileInvokeMock.mockResolvedValue(null);

    render(
      <HarnessRunSummaryCard
        conversationId='group-1'
        workspace='/workspace'
        running={false}
        collaboration={{
          mode: 'planner-generator-evaluator',
          executionBoundary: {
            type: 'git-repository',
            repositoryRoot: '/workspace/repo',
            branch: 'main',
          },
        }}
        orchestration={{ mode: 'debate', rounds: 2 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No harness artifacts yet.')).toBeInTheDocument();
    });
  });

  it('renders error status from the latest manifest', async () => {
    readFileInvokeMock.mockResolvedValue(JSON.stringify(createManifest('error')));

    render(
      <HarnessRunSummaryCard
        conversationId='group-1'
        workspace='/workspace'
        running={false}
        collaboration={{
          mode: 'planner-generator-evaluator',
          executionBoundary: {
            type: 'git-repository',
            repositoryRoot: '/workspace/repo',
            branch: 'main',
          },
        }}
        orchestration={{ mode: 'debate', rounds: 2 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });
});
