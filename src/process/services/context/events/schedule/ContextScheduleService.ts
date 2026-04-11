/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { getPlatformServices } from '@/common/platform';
import type { TChatConversation } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import { getDatabase } from '@process/services/database';
import type { IConversationRepository } from '@process/services/database/IConversationRepository';
import i18n, { i18nReady } from '@process/services/i18n';
import { ProcessConfig } from '@process/utils/initStorage';
import { addMessage } from '@process/utils/message';
import { Cron } from 'croner';
import type { ContextTriggerRouter } from '../ContextTriggerRouter';
import type { ConversationScheduleDispatcher } from './ConversationScheduleDispatcher';
import type {
  ContextSchedule,
  ContextSchedulePatch,
  ContextScheduleStore,
  CreateContextScheduleInput,
  CreateConversationScheduleInput,
} from './types';
import { isConversationSchedule } from './types';
import { assertValidScheduleSpec } from './scheduleValidation';
import type { WorkspaceConversationScheduleRecord, WorkspaceScheduleConfigStore } from './WorkspaceScheduleConfigStore';
import type { WorkspaceScheduleRuntimeStore } from './WorkspaceScheduleRuntimeStore';

const DEFAULT_MAX_RETRIES = 3;

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function mergeSchedule(existing: ContextSchedule, updates: ContextSchedulePatch): ContextSchedule {
  return {
    ...existing,
    ...updates,
    schedule: updates.schedule ?? existing.schedule,
    scope: updates.scope ? { ...existing.scope, ...updates.scope } : existing.scope,
    target: updates.target ?? existing.target,
    state: updates.state ? { ...existing.state, ...updates.state } : existing.state,
    updatedAt: Date.now(),
  };
}

function extractConversationDefaults(conversation: TChatConversation | undefined): {
  spaceId?: string;
  conversationTitle?: string;
  workspacePath?: string;
} {
  const extra = conversation?.extra as Record<string, unknown> | undefined;
  const spaceId = typeof extra?.spaceId === 'string' && extra.spaceId.trim() ? extra.spaceId : undefined;
  const workingDirectory =
    typeof extra?.workingDirectory === 'string' && extra.workingDirectory.trim() ? extra.workingDirectory : undefined;
  const workspace = typeof extra?.workspace === 'string' && extra.workspace.trim() ? extra.workspace : undefined;

  return {
    spaceId,
    conversationTitle: conversation?.name,
    workspacePath: workingDirectory ?? workspace,
  };
}

function createDefaultScheduleState(): ContextSchedule['state'] {
  return {
    runCount: 0,
    retryCount: 0,
    maxRetries: DEFAULT_MAX_RETRIES,
  };
}

function getResolvedWorkspacePathFromConversation(conversation: TChatConversation | undefined): string | undefined {
  return extractConversationDefaults(conversation).workspacePath;
}

function getResolvedWorkspacePathFromSchedule(schedule: ContextSchedule): string | undefined {
  return isConversationSchedule(schedule) ? schedule.target.workspacePath : undefined;
}

function isWorkspaceBackedConversationSchedule(schedule: ContextSchedule): schedule is ContextSchedule & {
  target: Extract<ContextSchedule['target'], { kind: 'send_query' }> & { workspacePath: string };
} {
  return (
    isConversationSchedule(schedule) &&
    typeof schedule.target.workspacePath === 'string' &&
    schedule.target.workspacePath.length > 0
  );
}

function toWorkspaceConversationScheduleRecord(
  schedule: ContextSchedule & { target: Extract<ContextSchedule['target'], { kind: 'send_query' }> }
): WorkspaceConversationScheduleRecord {
  return {
    id: schedule.id,
    name: schedule.name,
    enabled: schedule.enabled,
    schedule: schedule.schedule,
    message: schedule.target.message,
    conversationId: schedule.target.conversationId,
    conversationTitle: schedule.target.conversationTitle,
    agentType: schedule.target.agentType,
    createdBy: schedule.createdBy === 'system' ? 'user' : schedule.createdBy,
    spaceId: schedule.scope.spaceId,
  };
}

function hasScheduleDefinitionChanged(existing: ContextSchedule, next: ContextSchedule): boolean {
  const existingShape = {
    name: existing.name,
    enabled: existing.enabled,
    schedule: existing.schedule,
    scope: existing.scope,
    target: existing.target,
    owner: existing.owner,
    createdBy: existing.createdBy,
  };
  const nextShape = {
    name: next.name,
    enabled: next.enabled,
    schedule: next.schedule,
    scope: next.scope,
    target: next.target,
    owner: next.owner,
    createdBy: next.createdBy,
  };

  return JSON.stringify(existingShape) !== JSON.stringify(nextShape);
}

function computeNextRunAtMs(schedule: ContextSchedule): number | undefined {
  switch (schedule.schedule.kind) {
    case 'cron': {
      const cron = new Cron(schedule.schedule.expr, { timezone: schedule.schedule.tz });
      const nextRun = cron.nextRun();
      cron.stop();
      return nextRun ? nextRun.getTime() : undefined;
    }
    case 'every':
      return Date.now() + schedule.schedule.everyMs;
    case 'at':
      return schedule.schedule.atMs > Date.now() ? schedule.schedule.atMs : undefined;
  }
}

export class ContextScheduleService {
  private timers = new Map<string, Cron | NodeJS.Timeout>();
  private retryTimers = new Map<string, NodeJS.Timeout>();
  private retryCounts = new Map<string, number>();
  private initialized = false;
  private workspaceScheduleLock: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: ContextScheduleStore,
    private readonly triggerRouter: Pick<ContextTriggerRouter, 'queueTimerTrigger' | 'getTriggerRegistry'>,
    private readonly conversationDispatcher: Pick<
      ConversationScheduleDispatcher,
      'isConversationBusy' | 'executeSchedule' | 'onceIdle'
    >,
    private readonly conversationRepo: IConversationRepository,
    private readonly workspaceScheduleConfigStore: WorkspaceScheduleConfigStore,
    private readonly workspaceScheduleRuntimeStore: WorkspaceScheduleRuntimeStore
  ) {}

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.syncAllWorkspaceConversationSchedules();
    await this.cleanupOrphanConversationSchedules();

    const schedules = await this.store.listEnabled();
    for (const schedule of schedules) {
      await this.startTimer(schedule);
    }

    this.initialized = true;
  }

  private async withWorkspaceScheduleLock<T>(task: () => Promise<T>): Promise<T> {
    const next = this.workspaceScheduleLock.catch((): void => undefined).then(task);
    this.workspaceScheduleLock = next.then((): void => undefined).catch((): void => undefined);
    return next;
  }

  private async resolveMirroredRuntimeState(
    workspacePath: string,
    scheduleId: string,
    fallbackState?: ContextSchedule['state']
  ): Promise<ContextSchedule['state'] | undefined> {
    const mirroredState = await this.workspaceScheduleRuntimeStore.readState(workspacePath, scheduleId);
    return mirroredState ?? fallbackState;
  }

  private async syncWorkspaceRuntimeSnapshot(schedule: ContextSchedule): Promise<void> {
    if (!isConversationSchedule(schedule) || !getResolvedWorkspacePathFromSchedule(schedule)) {
      return;
    }

    await this.workspaceScheduleRuntimeStore.writeSnapshot(schedule);
  }

  private async appendWorkspaceRuntimeHistory(
    schedule: ContextSchedule,
    event: Parameters<WorkspaceScheduleRuntimeStore['appendHistory']>[1]
  ): Promise<void> {
    if (!isConversationSchedule(schedule) || !getResolvedWorkspacePathFromSchedule(schedule)) {
      return;
    }

    await this.workspaceScheduleRuntimeStore.appendHistory(schedule, event);
  }

  private buildConversationScheduleFromRecord(
    record: WorkspaceConversationScheduleRecord,
    conversation: TChatConversation,
    existing?: ContextSchedule,
    mirroredState?: ContextSchedule['state']
  ): ContextSchedule {
    const defaults = extractConversationDefaults(conversation);
    const now = Date.now();

    return {
      id: record.id,
      name: record.name,
      enabled: record.enabled,
      owner: 'user',
      createdBy: record.createdBy,
      schedule: record.schedule,
      scope: {
        kind: 'conversation',
        spaceId: record.spaceId ?? defaults.spaceId ?? existing?.scope.spaceId ?? '',
        conversationId: record.conversationId,
        threadId: record.conversationId,
        label: record.conversationTitle ?? conversation.name,
      },
      target: {
        kind: 'send_query',
        conversationId: record.conversationId,
        message: record.message,
        agentType: record.agentType,
        conversationTitle: record.conversationTitle ?? conversation.name,
        workspacePath: defaults.workspacePath,
        yoloMode: true,
      },
      state: mirroredState ?? existing?.state ?? createDefaultScheduleState(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  private async syncWorkspaceConversationSchedulesForWorkspace(
    workspacePath: string,
    conversations: TChatConversation[]
  ): Promise<void> {
    if (!workspacePath || conversations.length === 0) {
      return;
    }

    const conversationMap = new Map(conversations.map((conversation) => [conversation.id, conversation]));
    const allSchedules = await this.store.listAll();
    const existingWorkspaceSchedules = allSchedules.filter(
      (
        schedule
      ): schedule is ContextSchedule & {
        target: Extract<ContextSchedule['target'], { kind: 'send_query' }> & { workspacePath: string };
      } =>
        isWorkspaceBackedConversationSchedule(schedule) &&
        getResolvedWorkspacePathFromSchedule(schedule) === workspacePath &&
        conversationMap.has(schedule.target.conversationId)
    );
    let records = await this.workspaceScheduleConfigStore.readConversationSchedules(workspacePath);

    if (records === null && existingWorkspaceSchedules.length > 0) {
      records = existingWorkspaceSchedules.map((schedule) => toWorkspaceConversationScheduleRecord(schedule));
      await this.workspaceScheduleConfigStore.writeConversationSchedules(workspacePath, records);
    }

    const declaredRecords = records ?? [];
    const existingById = new Map(existingWorkspaceSchedules.map((schedule) => [schedule.id, schedule]));
    const existingByConversationId = new Map(
      existingWorkspaceSchedules.map((schedule) => [schedule.target.conversationId, schedule])
    );
    const declaredIds = new Set<string>();

    for (const record of declaredRecords) {
      const conversation = conversationMap.get(record.conversationId);
      if (!conversation) {
        continue;
      }

      declaredIds.add(record.id);
      const existing = existingById.get(record.id) ?? existingByConversationId.get(record.conversationId);
      const mirroredState = await this.resolveMirroredRuntimeState(workspacePath, record.id, existing?.state);
      const nextSchedule = this.buildConversationScheduleFromRecord(record, conversation, existing, mirroredState);
      const hasMirroredStateChanged =
        Boolean(existing) && JSON.stringify(existing?.state) !== JSON.stringify(nextSchedule.state);

      if (!existing) {
        await this.store.insert(nextSchedule);
        if (nextSchedule.enabled) {
          await this.startTimer(nextSchedule);
        }
        const created = (await this.store.getById(nextSchedule.id)) ?? nextSchedule;
        await this.syncWorkspaceRuntimeSnapshot(created);
        this.emitJobCreated(nextSchedule);
        continue;
      }

      if (existing.id !== nextSchedule.id) {
        this.stopTimer(existing.id);
        await this.store.remove(existing.id);
        await this.store.insert({
          ...nextSchedule,
          state: nextSchedule.state,
          createdAt: existing.createdAt,
        });
        if (nextSchedule.enabled) {
          await this.startTimer(nextSchedule);
        }
        const replaced = (await this.store.getById(nextSchedule.id)) ?? nextSchedule;
        await this.syncWorkspaceRuntimeSnapshot(replaced);
        ipcBridge.schedule.onScheduleRemoved.emit({ scheduleId: existing.id });
        this.emitJobCreated(nextSchedule);
        continue;
      }

      if (!hasScheduleDefinitionChanged(existing, nextSchedule)) {
        if (hasMirroredStateChanged) {
          await this.store.update(existing.id, {
            state: nextSchedule.state,
          });
          const refreshed = (await this.store.getById(existing.id)) ?? nextSchedule;
          await this.syncWorkspaceRuntimeSnapshot(refreshed);
          continue;
        }

        await this.syncWorkspaceRuntimeSnapshot(nextSchedule);
        continue;
      }

      this.stopTimer(existing.id);
      await this.store.update(existing.id, {
        name: nextSchedule.name,
        enabled: nextSchedule.enabled,
        createdBy: nextSchedule.createdBy,
        schedule: nextSchedule.schedule,
        scope: nextSchedule.scope,
        target: nextSchedule.target,
        owner: nextSchedule.owner,
      });
      const updated = (await this.store.getById(existing.id)) ?? nextSchedule;
      if (updated.enabled) {
        await this.startTimer(updated);
      }
      await this.syncWorkspaceRuntimeSnapshot(updated);
      this.emitJobUpdated(updated);
    }

    for (const schedule of existingWorkspaceSchedules) {
      if (!declaredIds.has(schedule.id)) {
        await this.removeScheduleInternal(schedule.id, true);
      }
    }
  }

  private async syncAllWorkspaceConversationSchedules(): Promise<void> {
    await this.withWorkspaceScheduleLock(async () => {
      const conversations = await this.conversationRepo.listAllConversations();
      const workspaceMap = new Map<string, TChatConversation[]>();

      for (const conversation of conversations) {
        const workspacePath = getResolvedWorkspacePathFromConversation(conversation);
        if (!workspacePath) {
          continue;
        }

        const current = workspaceMap.get(workspacePath) ?? [];
        current.push(conversation);
        workspaceMap.set(workspacePath, current);
      }

      for (const [workspacePath, workspaceConversations] of workspaceMap.entries()) {
        await this.syncWorkspaceConversationSchedulesForWorkspace(workspacePath, workspaceConversations);
      }
    });
  }

  private async syncWorkspaceConversationSchedulesForConversation(conversationId: string): Promise<void> {
    await this.withWorkspaceScheduleLock(async () => {
      const conversation = await this.conversationRepo.getConversation(conversationId);
      const workspacePath = getResolvedWorkspacePathFromConversation(conversation);
      if (!conversation || !workspacePath) {
        return;
      }

      await this.syncWorkspaceConversationSchedulesForWorkspace(workspacePath, [conversation]);
    });
  }

  private async writeWorkspaceConversationDeclaration(
    schedule: ContextSchedule & { target: Extract<ContextSchedule['target'], { kind: 'send_query' }> }
  ): Promise<void> {
    const workspacePath = getResolvedWorkspacePathFromSchedule(schedule);
    if (!workspacePath) {
      return;
    }

    await this.withWorkspaceScheduleLock(async () => {
      const existing = (await this.workspaceScheduleConfigStore.readConversationSchedules(workspacePath)) ?? [];
      const nextRecord = toWorkspaceConversationScheduleRecord(schedule);
      const filtered = existing.filter(
        (record) => record.id !== nextRecord.id && record.conversationId !== nextRecord.conversationId
      );
      filtered.push(nextRecord);
      await this.workspaceScheduleConfigStore.writeConversationSchedules(workspacePath, filtered);
    });
  }

  private async moveWorkspaceConversationDeclaration(
    previous: ContextSchedule,
    next: ContextSchedule & { target: Extract<ContextSchedule['target'], { kind: 'send_query' }> }
  ): Promise<void> {
    const previousWorkspace = getResolvedWorkspacePathFromSchedule(previous);
    const nextWorkspace = getResolvedWorkspacePathFromSchedule(next);

    if (!previousWorkspace && !nextWorkspace) {
      return;
    }

    await this.withWorkspaceScheduleLock(async () => {
      await this.workspaceScheduleRuntimeStore.moveScheduleRuntime(
        previousWorkspace ?? undefined,
        nextWorkspace ?? undefined,
        previous.id
      );

      if (previousWorkspace) {
        const previousRecords =
          (await this.workspaceScheduleConfigStore.readConversationSchedules(previousWorkspace)) ?? [];
        const remaining = previousRecords.filter((record) => record.id !== previous.id);
        await this.workspaceScheduleConfigStore.writeConversationSchedules(previousWorkspace, remaining);
      }

      if (nextWorkspace) {
        const nextRecords = (await this.workspaceScheduleConfigStore.readConversationSchedules(nextWorkspace)) ?? [];
        const nextRecord = toWorkspaceConversationScheduleRecord(next);
        const filtered = nextRecords.filter(
          (record) => record.id !== nextRecord.id && record.conversationId !== nextRecord.conversationId
        );
        filtered.push(nextRecord);
        await this.workspaceScheduleConfigStore.writeConversationSchedules(nextWorkspace, filtered);
      }
    });
  }

  private async removeWorkspaceConversationDeclaration(schedule: ContextSchedule): Promise<void> {
    const workspacePath = getResolvedWorkspacePathFromSchedule(schedule);
    if (!workspacePath) {
      return;
    }

    await this.withWorkspaceScheduleLock(async () => {
      const existing = (await this.workspaceScheduleConfigStore.readConversationSchedules(workspacePath)) ?? [];
      await this.workspaceScheduleConfigStore.writeConversationSchedules(
        workspacePath,
        existing.filter((record) => record.id !== schedule.id)
      );
    });
  }
  async createConversationSchedule(input: CreateConversationScheduleInput): Promise<ContextSchedule> {
    await assertValidScheduleSpec(input.schedule);
    await this.syncWorkspaceConversationSchedulesForConversation(input.conversationId);

    const existing = await this.store.listByConversation(input.conversationId);
    if (existing.length > 0) {
      const duplicate = existing[0];
      await i18nReady;
      throw new Error(
        i18n.t('schedule:error.alreadyExists', {
          name: duplicate.name,
          id: duplicate.id,
        })
      );
    }

    const conversation = await this.conversationRepo.getConversation(input.conversationId);
    if (!conversation) {
      await i18nReady;
      throw new Error(i18n.t('schedule:error.conversationNotFound'));
    }

    const defaults = extractConversationDefaults(conversation);
    let spaceId = input.spaceId ?? defaults.spaceId;

    if (!spaceId) {
      const database = await getDatabase();
      const defaultSpace = database.getDefaultSpace();
      spaceId = defaultSpace.success ? defaultSpace.data?.id : undefined;
    }

    if (!spaceId) {
      throw new Error('No default space available for scheduled conversation');
    }

    const now = Date.now();
    const schedule: ContextSchedule = {
      id: createId('schedule'),
      name: input.name,
      enabled: true,
      owner: 'user',
      createdBy: input.createdBy,
      schedule: input.schedule,
      scope: {
        kind: 'conversation',
        spaceId,
        conversationId: input.conversationId,
        threadId: input.conversationId,
        label: input.conversationTitle ?? defaults.conversationTitle,
      },
      target: {
        kind: 'send_query',
        conversationId: input.conversationId,
        message: input.message,
        agentType: input.agentType,
        conversationTitle: input.conversationTitle ?? defaults.conversationTitle,
        workspacePath: input.workspacePath ?? defaults.workspacePath,
        yoloMode: true,
      },
      state: createDefaultScheduleState(),
      createdAt: now,
      updatedAt: now,
    };

    if (isConversationSchedule(schedule)) {
      await this.writeWorkspaceConversationDeclaration(schedule);
    }

    await this.store.insert(schedule);

    try {
      await this.conversationRepo.updateConversation(input.conversationId, {
        modifyTime: now,
      });
    } catch (error) {
      console.warn('[ContextScheduleService] Failed to update conversation modifyTime:', error);
    }

    if (schedule.enabled) {
      await this.startTimer(schedule);
    }

    const created = (await this.store.getById(schedule.id)) ?? schedule;
    await this.syncWorkspaceRuntimeSnapshot(created);
    await this.appendWorkspaceRuntimeHistory(created, { kind: 'created' });
    this.emitJobCreated(created);
    return created;
  }

  async createContextSchedule(input: CreateContextScheduleInput): Promise<ContextSchedule> {
    await assertValidScheduleSpec(input.schedule);

    const now = Date.now();
    const schedule: ContextSchedule = {
      ...input,
      id: createId('schedule'),
      state: {
        ...createDefaultScheduleState(),
        ...input.state,
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.store.insert(schedule);
    if (schedule.enabled) {
      await this.startTimer(schedule);
    }

    return (await this.store.getById(schedule.id)) ?? schedule;
  }

  async updateSchedule(scheduleId: string, updates: ContextSchedulePatch): Promise<ContextSchedule> {
    const existing = await this.store.getById(scheduleId);
    if (!existing) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }

    const next = mergeSchedule(existing, updates);
    await assertValidScheduleSpec(next.schedule);
    if (isConversationSchedule(next)) {
      await this.moveWorkspaceConversationDeclaration(existing, next);
    } else if (isConversationSchedule(existing)) {
      await this.removeWorkspaceConversationDeclaration(existing);
    }
    await this.store.update(scheduleId, updates);
    this.stopTimer(scheduleId);

    if (next.enabled) {
      await this.startTimer(next);
    } else {
      await this.store.update(scheduleId, { state: { nextRunAtMs: undefined } });
    }

    const updated = (await this.store.getById(scheduleId)) ?? next;
    await this.syncWorkspaceRuntimeSnapshot(updated);
    await this.appendWorkspaceRuntimeHistory(updated, { kind: 'updated' });
    this.emitJobUpdated(updated);
    return updated;
  }

  async runScheduleNow(scheduleId: string): Promise<ContextSchedule> {
    const schedule = await this.store.getById(scheduleId);
    if (!schedule) {
      await i18nReady;
      throw new Error(i18n.t('schedule:error.jobNotFound', { id: scheduleId }));
    }

    if (isConversationSchedule(schedule)) {
      await this.executeConversationSchedule(schedule, true);
    } else if (schedule.target.kind === 'context_job') {
      await this.executeContextJobSchedule(
        schedule as ContextSchedule & { target: Extract<ContextSchedule['target'], { kind: 'context_job' }> },
        true
      );
    }

    return (await this.store.getById(scheduleId)) ?? schedule;
  }

  async removeSchedule(scheduleId: string): Promise<void> {
    await this.removeScheduleInternal(scheduleId);
  }

  private async removeScheduleInternal(
    scheduleId: string,
    skipWorkspaceDeclarationSync: boolean = false
  ): Promise<void> {
    const existing = await this.store.getById(scheduleId);
    if (!existing) {
      return;
    }

    if (!skipWorkspaceDeclarationSync && isConversationSchedule(existing)) {
      await this.removeWorkspaceConversationDeclaration(existing);
    }

    await this.appendWorkspaceRuntimeHistory(existing, { kind: 'removed' });
    this.stopTimer(scheduleId);
    await this.store.remove(scheduleId);
    ipcBridge.schedule.onScheduleRemoved.emit({ scheduleId });
  }

  async removeByConversation(conversationId: string): Promise<number> {
    await this.syncWorkspaceConversationSchedulesForConversation(conversationId);
    const schedules = await this.store.listByConversation(conversationId);
    for (const schedule of schedules) {
      await this.removeSchedule(schedule.id);
    }
    return schedules.length;
  }

  async listSchedules(): Promise<ContextSchedule[]> {
    await this.syncAllWorkspaceConversationSchedules();
    return this.store.listAll();
  }

  async listConversationSchedules(conversationId: string): Promise<ContextSchedule[]> {
    await this.syncWorkspaceConversationSchedulesForConversation(conversationId);
    return this.store.listByConversation(conversationId);
  }

  async getSchedule(scheduleId: string): Promise<ContextSchedule | null> {
    return this.store.getById(scheduleId);
  }

  async handleSystemResume(): Promise<void> {
    const schedules = await this.store.listEnabled();

    for (const schedule of schedules) {
      this.stopTimer(schedule.id);

      const nextRunAt = schedule.state.nextRunAtMs;
      if (nextRunAt && nextRunAt <= Date.now()) {
        await this.store.update(schedule.id, {
          state: {
            lastStatus: 'missed',
            lastError: i18n.t('schedule:error.missedJob', {
              name: schedule.name,
              time: new Date(nextRunAt).toLocaleString(),
            }),
          },
        });
        this.insertMissedConversationMessage(schedule, nextRunAt);

        const missed = await this.store.getById(schedule.id);
        if (missed) {
          await this.syncWorkspaceRuntimeSnapshot(missed);
          await this.appendWorkspaceRuntimeHistory(missed, {
            kind: 'executed',
            status: 'missed',
            error: missed.state.lastError,
          });
          this.emitJobUpdated(missed);
          this.emitJobExecuted(missed.id, 'missed', missed.state.lastError);
        }
      }

      const latest = (await this.store.getById(schedule.id)) ?? schedule;
      if (latest.enabled) {
        await this.startTimer(latest);
        const restarted = await this.store.getById(schedule.id);
        if (restarted) {
          await this.syncWorkspaceRuntimeSnapshot(restarted);
          this.emitJobUpdated(restarted);
        }
      }
    }
  }

  private async cleanupOrphanConversationSchedules(): Promise<void> {
    const schedules = await this.store.listAll();
    for (const schedule of schedules) {
      if (!isConversationSchedule(schedule)) {
        continue;
      }

      const conversation = await this.conversationRepo.getConversation(schedule.target.conversationId);
      if (conversation) {
        continue;
      }

      await this.appendWorkspaceRuntimeHistory(schedule, { kind: 'removed' });
      this.stopTimer(schedule.id);
      await this.store.remove(schedule.id);
      ipcBridge.schedule.onScheduleRemoved.emit({ scheduleId: schedule.id });
    }
  }

  private async startTimer(schedule: ContextSchedule): Promise<void> {
    this.stopTimer(schedule.id);

    switch (schedule.schedule.kind) {
      case 'cron': {
        const timer = new Cron(
          schedule.schedule.expr,
          {
            timezone: schedule.schedule.tz,
            paused: false,
          },
          () => {
            void this.executeSchedule(schedule.id);
          }
        );
        this.timers.set(schedule.id, timer);
        await this.store.update(schedule.id, {
          state: {
            nextRunAtMs: computeNextRunAtMs(schedule),
          },
        });
        const updated = await this.store.getById(schedule.id);
        if (updated) {
          await this.syncWorkspaceRuntimeSnapshot(updated);
        }
        break;
      }
      case 'every': {
        const timer = setInterval(() => {
          void this.executeSchedule(schedule.id);
        }, schedule.schedule.everyMs);
        this.timers.set(schedule.id, timer);
        await this.store.update(schedule.id, {
          state: {
            nextRunAtMs: computeNextRunAtMs(schedule),
          },
        });
        const updated = await this.store.getById(schedule.id);
        if (updated) {
          await this.syncWorkspaceRuntimeSnapshot(updated);
        }
        break;
      }
      case 'at': {
        const delay = schedule.schedule.atMs - Date.now();
        if (delay <= 0) {
          await this.store.update(schedule.id, {
            enabled: false,
            state: {
              nextRunAtMs: undefined,
              lastStatus: 'skipped',
              lastError: i18n.t('schedule:error.scheduledTimePassed'),
            },
          });
          const skipped = await this.store.getById(schedule.id);
          if (skipped) {
            await this.syncWorkspaceRuntimeSnapshot(skipped);
          }
          return;
        }

        const timer = setTimeout(() => {
          void this.executeSchedule(schedule.id).finally(async () => {
            await this.updateSchedule(schedule.id, { enabled: false });
          });
        }, delay);
        this.timers.set(schedule.id, timer);
        await this.store.update(schedule.id, {
          state: {
            nextRunAtMs: computeNextRunAtMs(schedule),
          },
        });
        const updated = await this.store.getById(schedule.id);
        if (updated) {
          await this.syncWorkspaceRuntimeSnapshot(updated);
        }
        break;
      }
    }
  }

  private stopTimer(scheduleId: string): void {
    const timer = this.timers.get(scheduleId);
    if (timer) {
      if (timer instanceof Cron) {
        timer.stop();
      } else {
        clearTimeout(timer);
        clearInterval(timer);
      }
      this.timers.delete(scheduleId);
    }

    const retryTimer = this.retryTimers.get(scheduleId);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryTimers.delete(scheduleId);
    }

    this.retryCounts.delete(scheduleId);
  }

  private async executeSchedule(scheduleId: string): Promise<void> {
    const current = await this.store.getById(scheduleId);
    if (!current || !current.enabled) {
      return;
    }

    if (isConversationSchedule(current)) {
      await this.executeConversationSchedule(current);
      return;
    }

    if (current.target.kind === 'context_job') {
      await this.executeContextJobSchedule(
        current as ContextSchedule & { target: Extract<ContextSchedule['target'], { kind: 'context_job' }> }
      );
    }
  }

  private async executeConversationSchedule(
    schedule: ContextSchedule & { target: Extract<ContextSchedule['target'], { kind: 'send_query' }> },
    ignoreEnabled: boolean = false
  ): Promise<void> {
    if (!schedule.enabled && !ignoreEnabled) {
      return;
    }

    const conversationId = schedule.target.conversationId;

    if (this.conversationDispatcher.isConversationBusy(conversationId)) {
      const currentRetry = (this.retryCounts.get(schedule.id) ?? 0) + 1;
      this.retryCounts.set(schedule.id, currentRetry);
      await this.store.update(schedule.id, {
        state: {
          retryCount: currentRetry,
        },
      });
      const retrying = await this.store.getById(schedule.id);
      if (retrying) {
        await this.syncWorkspaceRuntimeSnapshot(retrying);
      }

      if (currentRetry > (schedule.state.maxRetries || DEFAULT_MAX_RETRIES)) {
        this.retryCounts.delete(schedule.id);
        await this.store.update(schedule.id, {
          state: {
            nextRunAtMs: schedule.enabled ? computeNextRunAtMs(schedule) : undefined,
            lastStatus: 'skipped',
            lastError: i18n.t('schedule:error.conversationBusy', {
              count: schedule.state.maxRetries || DEFAULT_MAX_RETRIES,
            }),
            retryCount: currentRetry,
          },
        });

        const skipped = await this.store.getById(schedule.id);
        if (skipped) {
          await this.syncWorkspaceRuntimeSnapshot(skipped);
          await this.appendWorkspaceRuntimeHistory(skipped, {
            kind: 'executed',
            status: 'skipped',
            error: skipped.state.lastError,
          });
          this.emitJobUpdated(skipped);
          this.emitJobExecuted(skipped.id, 'skipped', skipped.state.lastError);
        }
        return;
      }

      const retryTimer = setTimeout(() => {
        this.retryTimers.delete(schedule.id);
        void this.executeSchedule(schedule.id);
      }, 30_000);
      this.retryTimers.set(schedule.id, retryTimer);
      return;
    }

    const lastRunAtMs = Date.now();
    const currentRunCount = (schedule.state.runCount ?? 0) + 1;
    let lastStatus: ContextSchedule['state']['lastStatus'] = 'ok';
    let lastError: string | undefined;

    try {
      await this.conversationDispatcher.executeSchedule(schedule, (conversation) => {
        this.registerCompletionNotification(schedule, conversation);
      });
      this.retryCounts.delete(schedule.id);
      await this.conversationRepo.updateConversation(conversationId, {
        modifyTime: Date.now(),
      });
    } catch (error) {
      lastStatus = 'error';
      lastError = error instanceof Error ? error.message : String(error);
    }

    await this.store.update(schedule.id, {
      state: {
        nextRunAtMs: schedule.enabled ? computeNextRunAtMs(schedule) : undefined,
        lastRunAtMs,
        runCount: currentRunCount,
        retryCount: 0,
        lastStatus,
        lastError,
      },
    });

    const updated = await this.store.getById(schedule.id);
    if (updated) {
      await this.syncWorkspaceRuntimeSnapshot(updated);
      await this.appendWorkspaceRuntimeHistory(updated, {
        kind: 'executed',
        status: lastStatus,
        error: lastError,
      });
      this.emitJobUpdated(updated);
      this.emitJobExecuted(updated.id, lastStatus, lastError);
    }
  }

  private async executeContextJobSchedule(
    schedule: ContextSchedule & { target: Extract<ContextSchedule['target'], { kind: 'context_job' }> },
    ignoreEnabled: boolean = false
  ): Promise<void> {
    if (!schedule.enabled && !ignoreEnabled) {
      return;
    }

    const lastRunAtMs = Date.now();
    const currentRunCount = (schedule.state.runCount ?? 0) + 1;
    let lastStatus: ContextSchedule['state']['lastStatus'] = 'ok';
    let lastError: string | undefined;

    try {
      const triggerId =
        schedule.target.triggerId ||
        this.triggerRouter.getTriggerRegistry().findByKindAndJobType('timer', schedule.target.jobType)?.id;

      if (!triggerId) {
        throw new Error(`No timer trigger registered for context job type: ${schedule.target.jobType}`);
      }

      await this.triggerRouter.queueTimerTrigger({
        triggerId,
        spaceId: schedule.scope.spaceId,
        priority: schedule.target.priority,
        reason: schedule.target.reason,
        payload: schedule.target.payload,
        projectSlug: schedule.scope.projectSlug,
        threadId: schedule.scope.threadId,
        firedAt: new Date(lastRunAtMs).toISOString(),
        triggerEvent: schedule.target.triggerEvent ?? `schedule.${schedule.id}`,
        triggerLabel: schedule.target.triggerLabel ?? schedule.name,
      });
    } catch (error) {
      lastStatus = 'error';
      lastError = error instanceof Error ? error.message : String(error);
    }

    await this.store.update(schedule.id, {
      state: {
        nextRunAtMs: schedule.enabled ? computeNextRunAtMs(schedule) : undefined,
        lastRunAtMs,
        runCount: currentRunCount,
        retryCount: 0,
        lastStatus,
        lastError,
      },
    });

    const updated = await this.store.getById(schedule.id);
    if (updated) {
      await this.syncWorkspaceRuntimeSnapshot(updated);
      this.emitJobExecuted(updated.id, lastStatus, lastError);
    }
  }

  private registerCompletionNotification(schedule: ContextSchedule, conversation: TChatConversation): void {
    this.conversationDispatcher.onceIdle(conversation.id, async () => {
      const scheduleNotificationEnabled = await ProcessConfig.get('system.scheduleNotificationEnabled');
      if (!scheduleNotificationEnabled) {
        return;
      }

      await i18nReady;
      const title = i18n.t('schedule.notification.scheduledTaskComplete', {
        title:
          schedule.target.kind === 'send_query' ? (schedule.target.conversationTitle ?? schedule.name) : schedule.name,
      });
      const body = i18n.t('schedule.notification.taskDone');

      try {
        getPlatformServices().notification.send({ title, body });
      } catch {
        return;
      }
    });
  }

  private emitJobCreated(schedule: ContextSchedule): void {
    ipcBridge.schedule.onScheduleCreated.emit(schedule);
  }

  private emitJobUpdated(schedule: ContextSchedule): void {
    ipcBridge.schedule.onScheduleUpdated.emit(schedule);
  }

  private emitJobExecuted(jobId: string, status: 'ok' | 'error' | 'skipped' | 'missed', error?: string): void {
    ipcBridge.schedule.onScheduleExecuted.emit({ scheduleId: jobId, status, error });
  }

  private insertMissedConversationMessage(schedule: ContextSchedule, scheduledAtMs: number): void {
    if (!isConversationSchedule(schedule)) {
      return;
    }

    addMessage(schedule.target.conversationId, {
      id: uuid(),
      conversation_id: schedule.target.conversationId,
      msg_id: uuid(),
      type: 'text',
      position: 'left',
      status: 'finish',
      content: {
        content: i18n.t('schedule:error.missedJob', {
          name: schedule.name,
          time: new Date(scheduledAtMs).toLocaleString(),
        }),
      },
      createdAt: Date.now(),
    });
  }
}
