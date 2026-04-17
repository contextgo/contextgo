/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: vi.fn(() => '/tmp') },
}));

vi.mock('../../src/process/services/database', () => ({
  getDatabase: vi.fn(async () => ({
    listChannelRuns: vi.fn(() => ({ success: true, data: [] })),
    getAgentProfile: vi.fn(() => ({ success: true, data: null })),
  })),
}));

import { ActivitySnapshotBuilder } from '../../src/process/bridge/services/ActivitySnapshotBuilder';
import { getDatabase } from '../../src/process/services/database';
import type { IConversationRepository } from '../../src/process/services/database/IConversationRepository';
import type { IWorkerTaskManager } from '../../src/process/task/IWorkerTaskManager';
import type { TChatConversation } from '../../src/common/config/storage';
import type { TMessage } from '../../src/common/chat/chatLib';

const EXTENSIONS_EVAL_BASELINES = {
  maintenanceSnapshot: 'extensions-bridge/maintenance-snapshot-telemetry',
} as const;

function makeRepo(overrides?: Partial<IConversationRepository>): IConversationRepository {
  return {
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
    getMessages: vi.fn(async () => ({ data: [], total: 0, hasMore: false })),
    insertMessage: vi.fn(),
    getUserConversations: vi.fn(async () => ({
      data: [],
      total: 0,
      hasMore: false,
    })),
    listAllConversations: vi.fn(async () => []),
    searchMessages: vi.fn(async () => ({
      items: [],
      total: 0,
      page: 0,
      pageSize: 20,
      hasMore: false,
    })),
    ...overrides,
  };
}

function makeTaskManager(overrides?: Partial<IWorkerTaskManager>): IWorkerTaskManager {
  return {
    getTask: vi.fn(() => undefined),
    getOrBuildTask: vi.fn(),
    addTask: vi.fn(),
    kill: vi.fn(),
    clear: vi.fn(),
    listTasks: vi.fn(() => []),
    ...overrides,
  };
}

function makeConversation(overrides: Partial<TChatConversation> = {}): TChatConversation {
  return {
    id: 'c1',
    type: 'nanobot' as any,
    status: 'finished',
    modifyTime: Date.now(),
    createTime: Date.now(),
    ...overrides,
  } as TChatConversation;
}

function summarizeMaintenanceSnapshotBaseline(snapshot: Awaited<ReturnType<ActivitySnapshotBuilder['build']>>) {
  const maintenanceAgent = snapshot.agents.find((item) => item.runType === 'maintenance');
  const systemRun = snapshot.systemRuns[0];

  return {
    maintenanceAgent: {
      runType: maintenanceAgent?.runType ?? 'missing',
      runtimeStatus: maintenanceAgent?.runtimeStatus ?? 'unknown',
      assistantId: maintenanceAgent?.assistantId ?? null,
      governanceIdentity: maintenanceAgent?.governanceIdentity ?? null,
      maintenanceKind: maintenanceAgent?.maintenanceKind ?? null,
      latestArtifactSummary: maintenanceAgent?.latestArtifactSummary ?? null,
      artifactTargets: [...(maintenanceAgent?.artifactTargets ?? [])],
    },
    systemRun: {
      threadId: systemRun?.threadId ?? null,
      projectSlug: systemRun?.projectSlug ?? null,
      reason: systemRun?.reason ?? null,
      source: systemRun?.source ?? null,
      triggerEvent: systemRun?.triggerEvent ?? null,
      triggerLabel: systemRun?.triggerLabel ?? null,
      executionBoundaryPath: systemRun?.executionBoundaryPath ?? null,
      executionBoundaryLabel: systemRun?.executionBoundaryLabel ?? null,
    },
  };
}

describe('ActivitySnapshotBuilder', () => {
  let repo: IConversationRepository;
  let taskManager: IWorkerTaskManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockResolvedValue({
      listChannelRuns: vi.fn(() => ({ success: true, data: [] })),
      getAgentProfile: vi.fn(() => ({ success: true, data: null })),
    } as never);
    repo = makeRepo();
    taskManager = makeTaskManager();
  });

  it('returns correct totalConversations count', async () => {
    const conversations = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })];
    vi.mocked(repo.getUserConversations).mockResolvedValue({
      data: conversations,
      total: 2,
      hasMore: false,
    });
    vi.mocked(repo.getMessages).mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });

    const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

    expect(snapshot.totalConversations).toBe(2);
  });

  it('excludes health-check conversations from totalConversations', async () => {
    const conversations = [
      makeConversation({ id: 'c1' }),
      makeConversation({ id: 'hc1', extra: { isHealthCheck: true } as any }),
    ];
    vi.mocked(repo.getUserConversations).mockResolvedValue({
      data: conversations,
      total: 2,
      hasMore: false,
    });
    vi.mocked(repo.getMessages).mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });

    const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

    expect(snapshot.totalConversations).toBe(1);
  });

  it('correctly counts running conversations from task manager status', async () => {
    const conversations = [makeConversation({ id: 'c1', status: 'finished' })];
    vi.mocked(repo.getUserConversations).mockResolvedValue({
      data: conversations,
      total: 1,
      hasMore: false,
    });
    vi.mocked(repo.getMessages).mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });
    vi.mocked(taskManager.getTask).mockReturnValue({
      status: 'running',
    } as any);

    const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

    expect(snapshot.runningConversations).toBe(1);
  });

  it('returns zero runningConversations when no tasks are active', async () => {
    const conversations = [makeConversation({ id: 'c1', status: 'finished' })];
    vi.mocked(repo.getUserConversations).mockResolvedValue({
      data: conversations,
      total: 1,
      hasMore: false,
    });
    vi.mocked(repo.getMessages).mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });

    const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

    expect(snapshot.runningConversations).toBe(0);
  });

  it('groups conversations by agent backend', async () => {
    const conversations = [
      makeConversation({ id: 'c1', type: 'gemini' as any }),
      makeConversation({ id: 'c2', type: 'gemini' as any }),
      makeConversation({ id: 'c3' }),
    ];
    vi.mocked(repo.getUserConversations).mockResolvedValue({
      data: conversations,
      total: 3,
      hasMore: false,
    });
    vi.mocked(repo.getMessages).mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });

    const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

    const geminiAgent = snapshot.agents.find((a) => a.backend === 'gemini');
    expect(geminiAgent?.conversations).toBe(2);
    expect(snapshot.agents).toHaveLength(2);
  });

  it('maps error events to error state', async () => {
    const conversations = [makeConversation({ id: 'c1' })];
    vi.mocked(repo.getUserConversations).mockResolvedValue({
      data: conversations,
      total: 1,
      hasMore: false,
    });
    const errorMessage: Partial<TMessage> = {
      id: 'm1',
      type: 'agent_status',
      content: { status: 'error' } as any,
      createdAt: Date.now(),
    };
    vi.mocked(repo.getMessages).mockResolvedValue({
      data: [errorMessage as TMessage],
      total: 1,
      hasMore: false,
    });

    const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

    const agent = snapshot.agents[0];
    expect(agent?.state).toBe('error');
  });

  it(
    `[${EXTENSIONS_EVAL_BASELINES.maintenanceSnapshot}] keeps maintenance snapshot telemetry stable`,
    async () => {
    vi.mocked(repo.getUserConversations).mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });

    vi.mocked(getDatabase).mockResolvedValue({
      listChannelRuns: vi.fn(() => ({
        success: true,
        data: [
          {
            id: 'run-1',
            rootRunId: 'run-1',
            agentProfileId: 'profile-1',
            backend: 'context-engine',
            conversationId: 'thread-1',
            status: 'running',
            startedAt: Date.now(),
            metadata: {
              systemManaged: true,
              assistantId: 'system-context-engine-session-compactor',
              systemOwner: 'context-engine',
              systemRole: 'context-engine-session-compactor',
              governanceIdentity: 'session_steward',
              jobType: 'session_compaction',
              latestArtifactSummary: 'Session working context refreshed.',
              currentTask: 'Compressing repeated session signals',
              scopeLabel: 'workspace-alpha',
              threadId: 'thread-1',
              projectSlug: 'workspace-alpha',
              reason: 'Repeated signal pressure exceeded baseline',
              source: 'runtime-hook',
              trigger: {
                label: 'Release Session pressure',
                event: 'session.turn.completed',
              },
              executionBoundary: {
                vaultRoot: '/tmp/vault',
                spaceId: 'space-1',
                spaceName: 'Release Space',
              },
              artifactRelativePath: 'Sessions/thread-1.md',
              artifactTitle: 'Release Session',
              artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
              events: [
                {
                  kind: 'status',
                  text: 'Running session compaction',
                  at: Date.now(),
                },
              ],
            },
          },
        ],
      })),
      getAgentProfile: vi.fn(() => ({
        success: true,
        data: { name: 'Context Engine · Session Compactor' },
      })),
    } as never);

    const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

    expect(summarizeMaintenanceSnapshotBaseline(snapshot)).toEqual({
      maintenanceAgent: {
        runType: 'maintenance',
        runtimeStatus: 'running',
        assistantId: 'system-context-engine-session-compactor',
        governanceIdentity: 'session_steward',
        maintenanceKind: 'session_compaction',
        latestArtifactSummary: 'Session working context refreshed.',
        artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
      },
      systemRun: {
        threadId: 'thread-1',
        projectSlug: 'workspace-alpha',
        reason: 'Repeated signal pressure exceeded baseline',
        source: 'runtime-hook',
        triggerEvent: 'session.turn.completed',
        triggerLabel: 'Release Session pressure',
        executionBoundaryPath: '/tmp/vault',
        executionBoundaryLabel: 'Release Space',
      },
    });
    expect(snapshot.agents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backend: 'context-engine',
          runType: 'maintenance',
          systemManaged: true,
          assistantId: 'system-context-engine-session-compactor',
          systemOwner: 'context-engine',
          systemRole: 'context-engine-session-compactor',
          governanceIdentity: 'session_steward',
          scopeLabel: 'workspace-alpha',
          maintenanceKind: 'session_compaction',
          latestArtifactSummary: 'Session working context refreshed.',
          artifactRelativePath: 'Sessions/thread-1.md',
          artifactTitle: 'Release Session',
          artifactTargets: ['session_timeline', 'session_working_context', 'session_checkpoint'],
          currentTask: 'Compressing repeated session signals',
        }),
      ])
    );
  });

  it('returns empty agents array when no conversations exist', async () => {
    vi.mocked(repo.getUserConversations).mockResolvedValue({
      data: [],
      total: 0,
      hasMore: false,
    });

    const snapshot = await new ActivitySnapshotBuilder(repo, taskManager).build();

    expect(snapshot.totalConversations).toBe(0);
    expect(snapshot.agents).toHaveLength(0);
  });
});
