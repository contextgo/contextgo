/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import i18n, { i18nReady } from '@process/services/i18n';
import { Cron } from 'croner';
import type { ContextSchedule } from './types';

export async function assertValidScheduleSpec(schedule: ContextSchedule['schedule']): Promise<void> {
  await i18nReady;

  switch (schedule.kind) {
    case 'cron': {
      const expr = schedule.expr.trim();
      if (!expr) {
        throw new Error(i18n.t('schedule:error.invalidCronExpression'));
      }

      try {
        const cron = new Cron(expr, {
          timezone: schedule.tz,
          paused: true,
        });
        cron.stop();
      } catch {
        throw new Error(i18n.t('schedule:error.invalidCronExpression'));
      }
      return;
    }
    case 'every': {
      if (!Number.isFinite(schedule.everyMs) || schedule.everyMs <= 0) {
        throw new Error(i18n.t('schedule:error.invalidEveryInterval'));
      }
      return;
    }
    case 'at': {
      if (!Number.isFinite(schedule.atMs)) {
        throw new Error(i18n.t('schedule:error.invalidScheduledTime'));
      }
    }
  }
}
