/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/services/database';
import type {
  ContextSchedule,
  ContextSchedulePatch,
  ContextScheduleStore,
} from '@process/services/context/events/schedule/types';

export class SqliteContextScheduleStore implements ContextScheduleStore {
  async insert(schedule: ContextSchedule): Promise<void> {
    const result = (await getDatabase()).saveContextSchedule(schedule);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to insert context schedule');
    }
  }

  async update(scheduleId: string, updates: ContextSchedulePatch): Promise<void> {
    const existing = await this.getById(scheduleId);
    if (!existing) {
      throw new Error(`Context schedule not found: ${scheduleId}`);
    }

    const merged: ContextSchedule = {
      ...existing,
      ...updates,
      schedule: updates.schedule ?? existing.schedule,
      scope: updates.scope ? { ...existing.scope, ...updates.scope } : existing.scope,
      target: updates.target ?? existing.target,
      state: updates.state ? { ...existing.state, ...updates.state } : existing.state,
      updatedAt: Date.now(),
    };
    const result = (await getDatabase()).saveContextSchedule(merged);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to update context schedule');
    }
  }

  async remove(scheduleId: string): Promise<void> {
    const result = (await getDatabase()).removeContextSchedule(scheduleId);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to remove context schedule');
    }
  }

  async getById(scheduleId: string): Promise<ContextSchedule | null> {
    const result = (await getDatabase()).getContextSchedule(scheduleId);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to get context schedule');
    }
    return result.data ?? null;
  }

  async listAll(): Promise<ContextSchedule[]> {
    const result = (await getDatabase()).listContextSchedules();
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to list context schedules');
    }
    return result.data ?? [];
  }

  async listEnabled(): Promise<ContextSchedule[]> {
    const result = (await getDatabase()).listEnabledContextSchedules();
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to list enabled context schedules');
    }
    return result.data ?? [];
  }

  async listByConversation(conversationId: string): Promise<ContextSchedule[]> {
    const result = (await getDatabase()).listContextSchedulesByConversation(conversationId);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to list conversation schedules');
    }
    return result.data ?? [];
  }

  async removeByConversation(conversationId: string): Promise<number> {
    const result = (await getDatabase()).removeContextSchedulesByConversation(conversationId);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to remove conversation schedules');
    }
    return result.data ?? 0;
  }
}
