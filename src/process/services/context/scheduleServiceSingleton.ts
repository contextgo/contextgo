/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ContextScheduleService } from '@process/services/context/events/schedule/ContextScheduleService';

type ScheduleServiceApi = Pick<
  ContextScheduleService,
  | 'init'
  | 'handleSystemResume'
  | 'listSchedules'
  | 'listConversationSchedules'
  | 'getSchedule'
  | 'createConversationSchedule'
  | 'createContextSchedule'
  | 'updateSchedule'
  | 'runScheduleNow'
  | 'removeSchedule'
>;

async function getContextScheduleService(): Promise<ScheduleServiceApi> {
  const module = await import('@process/services/context/contextServiceSingleton');
  return module.contextScheduleService;
}

export const scheduleService: ScheduleServiceApi = {
  async init() {
    return (await getContextScheduleService()).init();
  },

  async handleSystemResume() {
    return (await getContextScheduleService()).handleSystemResume();
  },

  async listSchedules() {
    return (await getContextScheduleService()).listSchedules();
  },

  async listConversationSchedules(...args) {
    return (await getContextScheduleService()).listConversationSchedules(...args);
  },

  async getSchedule(...args) {
    return (await getContextScheduleService()).getSchedule(...args);
  },

  async createConversationSchedule(...args) {
    return (await getContextScheduleService()).createConversationSchedule(...args);
  },

  async createContextSchedule(...args) {
    return (await getContextScheduleService()).createContextSchedule(...args);
  },

  async updateSchedule(...args) {
    return (await getContextScheduleService()).updateSchedule(...args);
  },

  async runScheduleNow(...args) {
    return (await getContextScheduleService()).runScheduleNow(...args);
  },

  async removeSchedule(...args) {
    return (await getContextScheduleService()).removeSchedule(...args);
  },
};
