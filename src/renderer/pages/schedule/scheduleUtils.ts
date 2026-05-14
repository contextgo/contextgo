/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IContextSchedule } from '@/common/adapter/ipcBridge';

/**
 * Format schedule for display - use human-readable description
 */
export function formatSchedule(schedule: IContextSchedule): string {
  return schedule.schedule.description;
}

/**
 * Format next run time for display
 */
export function formatNextRun(nextRunAtMs?: number): string {
  if (!nextRunAtMs) return '-';
  const date = new Date(nextRunAtMs);
  return date.toLocaleString();
}

/**
 * Get job status flags
 */
export function getJobStatusFlags(schedule: IContextSchedule): { hasError: boolean; isPaused: boolean } {
  return {
    hasError: schedule.state.lastStatus === 'error',
    isPaused: !schedule.enabled,
  };
}

export function getSchedulePrimaryText(schedule: IContextSchedule): string {
  return schedule.target.kind === 'send_query' ? schedule.target.message : schedule.target.reason;
}

export function getScheduleConversationId(schedule: IContextSchedule): string | undefined {
  return (
    schedule.scope.conversationId ??
    (schedule.target.kind === 'send_query' ? schedule.target.conversationId : undefined)
  );
}

export function getScheduleConversationTitle(schedule: IContextSchedule): string | undefined {
  if (schedule.target.kind === 'send_query') {
    return schedule.target.conversationTitle ?? schedule.scope.label;
  }

  return schedule.scope.label;
}

export function getScheduleWorkspacePath(schedule: IContextSchedule): string | undefined {
  return schedule.target.kind === 'send_query' ? schedule.target.workspacePath : undefined;
}

export function getScheduleAgentType(schedule: IContextSchedule): string | undefined {
  return schedule.target.kind === 'send_query' ? schedule.target.agentType : undefined;
}
