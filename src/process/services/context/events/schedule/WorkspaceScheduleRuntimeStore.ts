/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import {
  getWorkspaceScheduleRuntimeDir,
  getWorkspaceScheduleRuntimeHistoryFile,
  getWorkspaceScheduleRuntimeStateFile,
} from '@process/bridge/services/workspaceAutomation';
import type { ContextSchedule, ContextScheduleRunStatus } from './types';

export type WorkspaceScheduleRuntimeHistoryKind = 'created' | 'updated' | 'executed' | 'removed';

export type WorkspaceScheduleRuntimeHistoryEvent = {
  kind: WorkspaceScheduleRuntimeHistoryKind;
  status?: ContextScheduleRunStatus;
  error?: string;
  timestamp?: number;
};

export type WorkspaceScheduleRuntimeStore = {
  readState(workspace: string | undefined, scheduleId: string): Promise<ContextSchedule['state'] | null>;
  writeSnapshot(schedule: ContextSchedule): Promise<void>;
  appendHistory(schedule: ContextSchedule, event: WorkspaceScheduleRuntimeHistoryEvent): Promise<void>;
  moveScheduleRuntime(
    previousWorkspace: string | undefined,
    nextWorkspace: string | undefined,
    scheduleId: string
  ): Promise<void>;
};

type WorkspaceScheduleRuntimeSnapshot = {
  version: 1;
  scheduleId: string;
  name: string;
  enabled: boolean;
  schedule: ContextSchedule['schedule'];
  scope: ContextSchedule['scope'];
  target: ContextSchedule['target'];
  state: ContextSchedule['state'];
  createdAt: number;
  updatedAt: number;
  syncedAt: number;
};

type WorkspaceScheduleRuntimeHistoryEntry = {
  version: 1;
  eventId: string;
  kind: WorkspaceScheduleRuntimeHistoryKind;
  scheduleId: string;
  name: string;
  enabled: boolean;
  schedule: ContextSchedule['schedule'];
  state: ContextSchedule['state'];
  scope: ContextSchedule['scope'];
  target: ContextSchedule['target'];
  status?: ContextScheduleRunStatus;
  error?: string;
  timestamp: number;
};

const WORKSPACE_SCHEDULE_RUNTIME_VERSION = 1;

function normalizeState(value: unknown): ContextSchedule['state'] | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ContextSchedule['state']>;
  if (
    typeof candidate.runCount !== 'number' ||
    !Number.isFinite(candidate.runCount) ||
    typeof candidate.retryCount !== 'number' ||
    !Number.isFinite(candidate.retryCount) ||
    typeof candidate.maxRetries !== 'number' ||
    !Number.isFinite(candidate.maxRetries)
  ) {
    return null;
  }

  return {
    nextRunAtMs:
      typeof candidate.nextRunAtMs === 'number' && Number.isFinite(candidate.nextRunAtMs)
        ? candidate.nextRunAtMs
        : undefined,
    lastRunAtMs:
      typeof candidate.lastRunAtMs === 'number' && Number.isFinite(candidate.lastRunAtMs)
        ? candidate.lastRunAtMs
        : undefined,
    lastStatus:
      candidate.lastStatus === 'ok' ||
      candidate.lastStatus === 'error' ||
      candidate.lastStatus === 'skipped' ||
      candidate.lastStatus === 'missed'
        ? candidate.lastStatus
        : undefined,
    lastError: typeof candidate.lastError === 'string' && candidate.lastError.trim() ? candidate.lastError : undefined,
    runCount: candidate.runCount,
    retryCount: candidate.retryCount,
    maxRetries: candidate.maxRetries,
  };
}

function buildSnapshot(schedule: ContextSchedule): WorkspaceScheduleRuntimeSnapshot {
  return {
    version: WORKSPACE_SCHEDULE_RUNTIME_VERSION,
    scheduleId: schedule.id,
    name: schedule.name,
    enabled: schedule.enabled,
    schedule: schedule.schedule,
    scope: schedule.scope,
    target: schedule.target,
    state: schedule.state,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    syncedAt: Date.now(),
  };
}

function buildHistoryEntry(
  schedule: ContextSchedule,
  event: WorkspaceScheduleRuntimeHistoryEvent
): WorkspaceScheduleRuntimeHistoryEntry {
  return {
    version: WORKSPACE_SCHEDULE_RUNTIME_VERSION,
    eventId: `schedule-history-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    kind: event.kind,
    scheduleId: schedule.id,
    name: schedule.name,
    enabled: schedule.enabled,
    schedule: schedule.schedule,
    state: schedule.state,
    scope: schedule.scope,
    target: schedule.target,
    status: event.status,
    error: event.error,
    timestamp: event.timestamp ?? Date.now(),
  };
}

export class JsonWorkspaceScheduleRuntimeStore implements WorkspaceScheduleRuntimeStore {
  async readState(workspace: string | undefined, scheduleId: string): Promise<ContextSchedule['state'] | null> {
    const stateFile = getWorkspaceScheduleRuntimeStateFile(workspace, scheduleId);
    if (!stateFile) {
      return null;
    }

    try {
      const raw = await fs.readFile(stateFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<WorkspaceScheduleRuntimeSnapshot>;
      return normalizeState(parsed.state);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === 'ENOENT') {
        return null;
      }

      console.warn('[WorkspaceScheduleRuntimeStore] Failed to read runtime state:', stateFile, error);
      return null;
    }
  }

  async writeSnapshot(schedule: ContextSchedule): Promise<void> {
    const stateFile = getWorkspaceScheduleRuntimeStateFile(
      schedule.target.kind === 'send_query' ? schedule.target.workspacePath : undefined,
      schedule.id
    );
    if (!stateFile) {
      return;
    }

    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile, `${JSON.stringify(buildSnapshot(schedule), null, 2)}\n`, 'utf-8');
  }

  async appendHistory(schedule: ContextSchedule, event: WorkspaceScheduleRuntimeHistoryEvent): Promise<void> {
    const historyFile = getWorkspaceScheduleRuntimeHistoryFile(
      schedule.target.kind === 'send_query' ? schedule.target.workspacePath : undefined,
      schedule.id
    );
    if (!historyFile) {
      return;
    }

    await fs.mkdir(path.dirname(historyFile), { recursive: true });
    await fs.appendFile(historyFile, `${JSON.stringify(buildHistoryEntry(schedule, event))}\n`, 'utf-8');
  }

  async moveScheduleRuntime(
    previousWorkspace: string | undefined,
    nextWorkspace: string | undefined,
    scheduleId: string
  ): Promise<void> {
    const previousRuntimeDir = getWorkspaceScheduleRuntimeDir(previousWorkspace, scheduleId);
    const nextRuntimeDir = getWorkspaceScheduleRuntimeDir(nextWorkspace, scheduleId);

    if (!previousRuntimeDir || !nextRuntimeDir || previousRuntimeDir === nextRuntimeDir) {
      return;
    }

    try {
      await fs.access(previousRuntimeDir);
    } catch {
      return;
    }

    try {
      await fs.access(nextRuntimeDir);
      return;
    } catch {
      await fs.mkdir(path.dirname(nextRuntimeDir), { recursive: true });
      await fs.rename(previousRuntimeDir, nextRuntimeDir);
    }
  }
}
