import { describe, expect, it, vi } from 'vitest';
import { ContextScheduleService } from '../../../src/process/services/context/events/schedule/ContextScheduleService';
import { CONTEXT_ENGINE_BUILTIN_TRIGGERS } from '../../../src/process/services/context/events/triggers/builtinTriggers';
import type {
  ContextSchedule,
  ContextSchedulePatch,
  ContextScheduleStore,
} from '../../../src/process/services/context/events/schedule/types';
import type {
  WorkspaceConversationScheduleRecord,
  WorkspaceScheduleConfigStore,
} from '../../../src/process/services/context/events/schedule/WorkspaceScheduleConfigStore';
import type {
  WorkspaceScheduleRuntimeHistoryEvent,
  WorkspaceScheduleRuntimeStore,
} from '../../../src/process/services/context/events/schedule/WorkspaceScheduleRuntimeStore';

function createMemoryStore(seed: ContextSchedule[] = []): ContextScheduleStore {
  const store = new Map(seed.map((item) => [item.id, item]));
  return {
    async insert(schedule) {
      store.set(schedule.id, schedule);
    },
    async update(scheduleId, updates: ContextSchedulePatch) {
      const existing = store.get(scheduleId);
      if (!existing) {
        throw new Error(`missing:${scheduleId}`);
      }
      store.set(scheduleId, {
        ...existing,
        ...updates,
        schedule: updates.schedule ?? existing.schedule,
        scope: updates.scope ? { ...existing.scope, ...updates.scope } : existing.scope,
        target: updates.target ?? existing.target,
        state: updates.state ? { ...existing.state, ...updates.state } : existing.state,
        updatedAt: Date.now(),
      });
    },
    async remove(scheduleId) {
      store.delete(scheduleId);
    },
    async getById(scheduleId) {
      return store.get(scheduleId) ?? null;
    },
    async listAll() {
      return [...store.values()];
    },
    async listEnabled() {
      return [...store.values()].filter((item) => item.enabled);
    },
    async listByConversation(conversationId) {
      return [...store.values()].filter((item) => item.scope.conversationId === conversationId);
    },
    async removeByConversation(conversationId) {
      const before = store.size;
      for (const [id, item] of store.entries()) {
        if (item.scope.conversationId === conversationId) {
          store.delete(id);
        }
      }
      return before - store.size;
    },
  };
}

function createService(seed: ContextSchedule[] = []) {
  const executeSchedule = vi.fn();
  const workspaceConfigs = new Map<string, WorkspaceConversationScheduleRecord[]>();
  const runtimeStates = new Map<string, ContextSchedule['state']>();
  const runtimeHistory = new Map<string, WorkspaceScheduleRuntimeHistoryEvent[]>();
  const queueTimerTrigger = vi.fn();
  const findByKindAndJobType = vi.fn();
  const workspaceScheduleConfigStore: WorkspaceScheduleConfigStore = {
    async readConversationSchedules(workspace) {
      if (!workspace) {
        return null;
      }
      return workspaceConfigs.has(workspace) ? [...(workspaceConfigs.get(workspace) ?? [])] : null;
    },
    async writeConversationSchedules(workspace, records) {
      workspaceConfigs.set(workspace, [...records]);
    },
  };
  const workspaceScheduleRuntimeStore: WorkspaceScheduleRuntimeStore = {
    async readState(workspace, scheduleId) {
      if (!workspace) {
        return null;
      }
      return runtimeStates.get(`${workspace}:${scheduleId}`) ?? null;
    },
    async writeSnapshot(schedule) {
      if (schedule.target.kind !== 'send_query' || !schedule.target.workspacePath) {
        return;
      }
      runtimeStates.set(`${schedule.target.workspacePath}:${schedule.id}`, { ...schedule.state });
    },
    async appendHistory(schedule, event) {
      if (schedule.target.kind !== 'send_query' || !schedule.target.workspacePath) {
        return;
      }
      const key = `${schedule.target.workspacePath}:${schedule.id}`;
      const current = runtimeHistory.get(key) ?? [];
      current.push(event);
      runtimeHistory.set(key, current);
    },
    async moveScheduleRuntime(previousWorkspace, nextWorkspace, scheduleId) {
      if (!previousWorkspace || !nextWorkspace || previousWorkspace === nextWorkspace) {
        return;
      }
      const previousKey = `${previousWorkspace}:${scheduleId}`;
      const nextKey = `${nextWorkspace}:${scheduleId}`;
      const previousState = runtimeStates.get(previousKey);
      if (previousState) {
        runtimeStates.set(nextKey, previousState);
        runtimeStates.delete(previousKey);
      }
      const previousHistory = runtimeHistory.get(previousKey);
      if (previousHistory) {
        runtimeHistory.set(nextKey, previousHistory);
        runtimeHistory.delete(previousKey);
      }
    },
  };
  const service = new ContextScheduleService(
    createMemoryStore(seed),
    {
      queueTimerTrigger,
      getTriggerRegistry: () => ({
        findByKindAndJobType,
      }),
    },
    {
      isConversationBusy: vi.fn(() => false),
      executeSchedule,
      onceIdle: vi.fn(),
    },
    {
      getConversation: vi.fn(async () => ({
        id: 'conv-1',
        name: 'Daily thread',
        extra: { spaceId: 'space-1', workspace: '/tmp/workspace' },
      })),
      listAllConversations: vi.fn(async () => [
        {
          id: 'conv-1',
          name: 'Daily thread',
          extra: { spaceId: 'space-1', workspace: '/tmp/workspace' },
        },
      ]),
      updateConversation: vi.fn(),
    } as never,
    workspaceScheduleConfigStore,
    workspaceScheduleRuntimeStore
  );

  return {
    service,
    executeSchedule,
    workspaceConfigs,
    runtimeStates,
    runtimeHistory,
    queueTimerTrigger,
    findByKindAndJobType,
  };
}

describe('ContextScheduleService', () => {
  it('creates user conversation schedules with conversation scope metadata', async () => {
    const { service, workspaceConfigs, runtimeHistory, runtimeStates } = createService();

    const schedule = await service.createConversationSchedule({
      name: 'Morning sync',
      schedule: { kind: 'cron', expr: '0 9 * * *', description: 'Every day at 09:00' },
      message: 'ping',
      conversationId: 'conv-1',
      conversationTitle: 'Daily thread',
      workspacePath: '/tmp/workspace',
      agentType: 'codex',
      createdBy: 'user',
      spaceId: 'space-1',
    });

    expect(schedule.owner).toBe('user');
    expect(schedule.scope).toMatchObject({
      kind: 'conversation',
      conversationId: 'conv-1',
      spaceId: 'space-1',
      threadId: 'conv-1',
    });
    expect(schedule.target).toMatchObject({
      kind: 'send_query',
      conversationId: 'conv-1',
      message: 'ping',
      agentType: 'codex',
    });
    expect(workspaceConfigs.get('/tmp/workspace')).toContainEqual({
      id: schedule.id,
      name: 'Morning sync',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 9 * * *', description: 'Every day at 09:00' },
      message: 'ping',
      conversationId: 'conv-1',
      conversationTitle: 'Daily thread',
      agentType: 'codex',
      createdBy: 'user',
      spaceId: 'space-1',
    });
    expect(runtimeStates.get(`/tmp/workspace:${schedule.id}`)).toMatchObject({
      runCount: 0,
      retryCount: 0,
      maxRetries: 3,
    });
    expect(runtimeHistory.get(`/tmp/workspace:${schedule.id}`)).toEqual([{ kind: 'created' }]);

    await service.removeSchedule(schedule.id);
  });

  it('runs a paused conversation schedule immediately without re-enabling it', async () => {
    const pausedSchedule: ContextSchedule = {
      id: 'schedule-1',
      name: 'Paused summary',
      enabled: false,
      owner: 'user',
      createdBy: 'user',
      schedule: {
        kind: 'cron',
        expr: '0 9 * * *',
        description: 'Every day at 09:00',
      },
      scope: {
        kind: 'conversation',
        spaceId: 'space-1',
        conversationId: 'conv-1',
        threadId: 'conv-1',
        label: 'Daily thread',
      },
      target: {
        kind: 'send_query',
        conversationId: 'conv-1',
        conversationTitle: 'Daily thread',
        agentType: 'gemini',
        message: 'Generate the daily summary',
        workspacePath: '/tmp/workspace',
      },
      state: {
        runCount: 0,
        retryCount: 0,
        maxRetries: 3,
      },
      createdAt: 1,
      updatedAt: 1,
    };
    const { service, executeSchedule, runtimeHistory, runtimeStates } = createService([pausedSchedule]);

    const updated = await service.runScheduleNow('schedule-1');

    expect(executeSchedule).toHaveBeenCalledTimes(1);
    expect(updated.enabled).toBe(false);
    expect(updated.state.runCount).toBe(1);
    expect(updated.state.lastStatus).toBe('ok');
    expect(updated.state.lastRunAtMs).toBeTypeOf('number');
    expect(updated.state.nextRunAtMs).toBeUndefined();
    expect(runtimeStates.get('/tmp/workspace:schedule-1')).toMatchObject({
      runCount: 1,
      retryCount: 0,
      lastStatus: 'ok',
    });
    expect(runtimeHistory.get('/tmp/workspace:schedule-1')).toContainEqual({
      kind: 'executed',
      status: 'ok',
      error: undefined,
    });
  });

  it('runs project capability curation schedules through the timer trigger router', async () => {
    const { service, queueTimerTrigger, findByKindAndJobType } = createService();
    findByKindAndJobType.mockReturnValue({ id: 'timer.project-capability-curation' });

    const schedule = await service.createContextSchedule({
      name: 'Project capability refresh',
      enabled: true,
      owner: 'context-engine',
      createdBy: 'system',
      schedule: {
        kind: 'cron',
        expr: '0 * * * *',
        description: 'Every hour',
      },
      scope: {
        kind: 'project',
        spaceId: 'space-1',
        projectSlug: 'workspace-abcd1234',
        threadId: 'conv-1',
        label: 'workspace',
      },
      target: {
        kind: 'context_job',
        jobType: 'project_capability_curation',
        reason: 'Refresh project capability mirror.',
        payload: {
          summary: 'Refresh project capability mirror.',
        },
      },
    });

    const updated = await service.runScheduleNow(schedule.id);

    expect(findByKindAndJobType).toHaveBeenCalledWith('timer', 'project_capability_curation');
    expect(queueTimerTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerId: 'timer.project-capability-curation',
        spaceId: 'space-1',
        projectSlug: 'workspace-abcd1234',
        threadId: 'conv-1',
        reason: 'Refresh project capability mirror.',
        payload: {
          summary: 'Refresh project capability mirror.',
        },
      })
    );
    expect(updated.state.runCount).toBe(1);
    expect(updated.state.lastStatus).toBe('ok');
  });

  it('keeps the richer project curator trigger copy for timer and manual capability curation', async () => {
    const timerTrigger = CONTEXT_ENGINE_BUILTIN_TRIGGERS.find(
      (trigger) => trigger.id === 'timer.project-capability-curation'
    );
    const manualTrigger = CONTEXT_ENGINE_BUILTIN_TRIGGERS.find(
      (trigger) => trigger.id === 'manual.project-capability-curation'
    );

    expect(timerTrigger?.defaultReason).toBe(
      'Periodically refresh project docs and append-first proposals from local automation evidence.'
    );
    expect(manualTrigger?.defaultReason).toBe(
      'Manually refresh project docs, AGENTS append proposals, and skill proposals from local automation evidence.'
    );
  });

  it('keeps the richer space curator trigger copy for timer and manual distillation jobs', async () => {
    const timerTrigger = CONTEXT_ENGINE_BUILTIN_TRIGGERS.find(
      (trigger) => trigger.id === 'timer.space-memory-distillation'
    );
    const manualTrigger = CONTEXT_ENGINE_BUILTIN_TRIGGERS.find(
      (trigger) => trigger.id === 'manual.space-memory-distillation'
    );

    expect(timerTrigger?.defaultReason).toBe(
      'Periodically distill shared space memory and profile signals from recent project activity.'
    );
    expect(manualTrigger?.defaultReason).toBe(
      'Manually distill shared space memory and profile signals from recent project activity.'
    );
  });

  it('hydrates workspace schedule declarations into the runtime store when listing conversation schedules', async () => {
    const { service, workspaceConfigs, runtimeStates } = createService();
    workspaceConfigs.set('/tmp/workspace', [
      {
        id: 'workspace-schedule-1',
        name: 'Workspace digest',
        enabled: true,
        schedule: {
          kind: 'cron',
          expr: '0 8 * * *',
          description: 'Every day at 08:00',
        },
        message: 'Summarize project updates.',
        conversationId: 'conv-1',
        conversationTitle: 'Daily thread',
        agentType: 'codex',
        createdBy: 'user',
        spaceId: 'space-1',
      },
    ]);
    runtimeStates.set('/tmp/workspace:workspace-schedule-1', {
      nextRunAtMs: 1_700_000_000_000,
      lastRunAtMs: 1_699_999_000_000,
      lastStatus: 'error',
      lastError: 'Previous mirrored failure',
      runCount: 7,
      retryCount: 1,
      maxRetries: 3,
    });

    const schedules = await service.listConversationSchedules('conv-1');

    expect(schedules).toHaveLength(1);
    expect(schedules[0]).toMatchObject({
      id: 'workspace-schedule-1',
      name: 'Workspace digest',
      target: {
        kind: 'send_query',
        conversationId: 'conv-1',
        workspacePath: '/tmp/workspace',
        message: 'Summarize project updates.',
      },
    });
    expect(schedules[0].state).toMatchObject({
      runCount: 7,
      retryCount: 1,
      lastStatus: 'error',
      lastError: 'Previous mirrored failure',
    });
  });
});
