/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IContextSchedule } from '@/common/adapter/ipcBridge';

export type ScheduleEventAction = 'list' | 'create' | 'delete' | 'error';

export type ScheduleEventPayload = {
  source: 'assistant-skill';
  action: ScheduleEventAction;
  scheduleId?: string;
  schedules?: IContextSchedule[];
  schedule?: IContextSchedule;
  error?: string;
};
