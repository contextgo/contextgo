/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { scheduleService } from '@process/services/context/scheduleServiceSingleton';

/**
 * Initialize schedule IPC bridge handlers
 */
export function initScheduleBridge(): void {
  ipcBridge.schedule.listSchedules.provider(async () => {
    return scheduleService.listSchedules();
  });

  ipcBridge.schedule.listConversationSchedules.provider(async ({ conversationId }) => {
    return scheduleService.listConversationSchedules(conversationId);
  });

  ipcBridge.schedule.getSchedule.provider(async ({ scheduleId }) => {
    return scheduleService.getSchedule(scheduleId);
  });

  ipcBridge.schedule.createConversationSchedule.provider(async (params) => {
    return scheduleService.createConversationSchedule(params);
  });

  ipcBridge.schedule.createContextSchedule.provider(async (params) => {
    return scheduleService.createContextSchedule(params);
  });

  ipcBridge.schedule.updateSchedule.provider(async ({ scheduleId, updates }) => {
    return scheduleService.updateSchedule(scheduleId, updates);
  });

  ipcBridge.schedule.runScheduleNow.provider(async ({ scheduleId }) => {
    return scheduleService.runScheduleNow(scheduleId);
  });

  ipcBridge.schedule.removeSchedule.provider(async ({ scheduleId }) => {
    await scheduleService.removeSchedule(scheduleId);
  });
}
