/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs/promises';
import path from 'path';
import type { AcpBackendAll } from '@/common/types/acpTypes';
import { getWorkspaceSchedulesFile } from '@process/bridge/services/workspaceAutomation';
import type { ScheduleSpec } from './jobTypes';

export type WorkspaceConversationScheduleRecord = {
  id: string;
  name: string;
  enabled: boolean;
  schedule: ScheduleSpec;
  message: string;
  conversationId: string;
  conversationTitle?: string;
  agentType: AcpBackendAll;
  createdBy: 'user' | 'agent';
  spaceId?: string;
};

type WorkspaceScheduleConfig = {
  version: 1;
  conversationSchedules: WorkspaceConversationScheduleRecord[];
};

export type WorkspaceScheduleConfigStore = {
  readConversationSchedules(workspace?: string): Promise<WorkspaceConversationScheduleRecord[] | null>;
  writeConversationSchedules(workspace: string, records: WorkspaceConversationScheduleRecord[]): Promise<void>;
};

const WORKSPACE_SCHEDULE_CONFIG_VERSION = 1;

function normalizeScheduleSpec(value: unknown): ScheduleSpec | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<ScheduleSpec>;
  const description = typeof candidate.description === 'string' ? candidate.description.trim() : '';
  if (!description) {
    return null;
  }

  if (candidate.kind === 'cron' && typeof candidate.expr === 'string' && candidate.expr.trim()) {
    return {
      kind: 'cron',
      expr: candidate.expr.trim(),
      description,
      tz: typeof candidate.tz === 'string' && candidate.tz.trim() ? candidate.tz.trim() : undefined,
    };
  }

  if (candidate.kind === 'every' && typeof candidate.everyMs === 'number' && Number.isFinite(candidate.everyMs)) {
    return {
      kind: 'every',
      everyMs: candidate.everyMs,
      description,
    };
  }

  if (candidate.kind === 'at' && typeof candidate.atMs === 'number' && Number.isFinite(candidate.atMs)) {
    return {
      kind: 'at',
      atMs: candidate.atMs,
      description,
    };
  }

  return null;
}

function normalizeConversationScheduleRecord(value: unknown): WorkspaceConversationScheduleRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<WorkspaceConversationScheduleRecord>;
  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  const message = typeof candidate.message === 'string' ? candidate.message.trim() : '';
  const conversationId = typeof candidate.conversationId === 'string' ? candidate.conversationId.trim() : '';
  const agentType = typeof candidate.agentType === 'string' ? candidate.agentType.trim() : '';
  const schedule = normalizeScheduleSpec(candidate.schedule);

  if (!id || !name || !message || !conversationId || !agentType || !schedule) {
    return null;
  }

  return {
    id,
    name,
    enabled: candidate.enabled !== false,
    schedule,
    message,
    conversationId,
    conversationTitle:
      typeof candidate.conversationTitle === 'string' && candidate.conversationTitle.trim()
        ? candidate.conversationTitle.trim()
        : undefined,
    agentType: agentType as AcpBackendAll,
    createdBy: candidate.createdBy === 'agent' ? 'agent' : 'user',
    spaceId: typeof candidate.spaceId === 'string' && candidate.spaceId.trim() ? candidate.spaceId.trim() : undefined,
  };
}

function normalizeWorkspaceScheduleConfig(value: unknown): WorkspaceScheduleConfig {
  const config = value && typeof value === 'object' ? (value as Partial<WorkspaceScheduleConfig>) : undefined;
  const rawSchedules = Array.isArray(config?.conversationSchedules)
    ? config?.conversationSchedules
    : Array.isArray(value)
      ? value
      : [];

  const conversationSchedules: WorkspaceConversationScheduleRecord[] = [];
  const seenIds = new Set<string>();
  const seenConversationIds = new Set<string>();

  for (const item of rawSchedules) {
    const record = normalizeConversationScheduleRecord(item);
    if (!record) {
      continue;
    }

    if (seenIds.has(record.id) || seenConversationIds.has(record.conversationId)) {
      continue;
    }

    seenIds.add(record.id);
    seenConversationIds.add(record.conversationId);
    conversationSchedules.push(record);
  }

  return {
    version: WORKSPACE_SCHEDULE_CONFIG_VERSION,
    conversationSchedules,
  };
}

export class JsonWorkspaceScheduleConfigStore implements WorkspaceScheduleConfigStore {
  async readConversationSchedules(workspace?: string): Promise<WorkspaceConversationScheduleRecord[] | null> {
    const filePath = getWorkspaceSchedulesFile(workspace);
    if (!filePath) {
      return null;
    }

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return normalizeWorkspaceScheduleConfig(JSON.parse(raw)).conversationSchedules;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code === 'ENOENT') {
        return null;
      }

      console.warn('[WorkspaceScheduleConfigStore] Failed to read workspace schedules:', filePath, error);
      return [];
    }
  }

  async writeConversationSchedules(workspace: string, records: WorkspaceConversationScheduleRecord[]): Promise<void> {
    const filePath = getWorkspaceSchedulesFile(workspace);
    if (!filePath) {
      return;
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const payload: WorkspaceScheduleConfig = {
      version: WORKSPACE_SCHEDULE_CONFIG_VERSION,
      conversationSchedules: normalizeWorkspaceScheduleConfig({ conversationSchedules: records }).conversationSchedules,
    };
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  }
}
