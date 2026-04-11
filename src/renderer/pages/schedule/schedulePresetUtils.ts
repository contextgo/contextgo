/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import type { AcpBackendAll } from '@/common/types/acpTypes';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export type SchedulePresetId =
  | 'aiDigest'
  | 'competitorWatch'
  | 'morningFocus'
  | 'contentRadar'
  | 'saasUsageReview'
  | 'backlogPrioritization'
  | 'contentCalendar'
  | 'growthExperimentReview'
  | 'candidatePipelineReview'
  | 'interviewFeedbackDigest'
  | 'staleDealAlert'
  | 'policySignalWatch'
  | 'endOfDayReview'
  | 'userFeedbackDigest'
  | 'weeklyReview'
  | 'leadFollowUp';
export type CronPresetCategory = 'research' | 'planning' | 'review' | 'reporting' | 'operations';
export type CronPresetPack = 'saasProduct' | 'contentGrowth' | 'recruitingOps' | 'salesFollowUp' | 'researchMonitoring';

export type CronPreset = {
  id: SchedulePresetId;
  category: CronPresetCategory;
  packs: CronPresetPack[];
  name: string;
  description: string;
  schedule: {
    expr: string;
    description: string;
  };
  message: string;
  prompt: string;
};

export const CRON_PRESET_CATEGORY_ORDER: CronPresetCategory[] = [
  'research',
  'planning',
  'review',
  'reporting',
  'operations',
];

export const CRON_PRESET_PACK_ORDER: CronPresetPack[] = [
  'saasProduct',
  'contentGrowth',
  'recruitingOps',
  'salesFollowUp',
  'researchMonitoring',
];
export const DEFAULT_CRON_PRESET_PACK: CronPresetPack = 'saasProduct';
export const DEFAULT_CRON_PRESET_HERO_IDS: SchedulePresetId[] = [
  'morningFocus',
  'saasUsageReview',
  'backlogPrioritization',
  'competitorWatch',
  'userFeedbackDigest',
  'weeklyReview',
];

type CronPresetSeed = {
  id: SchedulePresetId;
  category: CronPresetCategory;
  packs: CronPresetPack[];
  scheduleExpr: string;
};

const CRON_PRESET_SEEDS: CronPresetSeed[] = [
  {
    id: 'aiDigest',
    category: 'research',
    packs: ['saasProduct', 'contentGrowth', 'researchMonitoring'],
    scheduleExpr: '0 9 * * MON-FRI',
  },
  {
    id: 'competitorWatch',
    category: 'research',
    packs: ['saasProduct', 'contentGrowth', 'salesFollowUp', 'researchMonitoring'],
    scheduleExpr: '0 14 * * MON-FRI',
  },
  {
    id: 'morningFocus',
    category: 'planning',
    packs: ['saasProduct', 'recruitingOps', 'salesFollowUp'],
    scheduleExpr: '30 9 * * MON-FRI',
  },
  {
    id: 'contentRadar',
    category: 'planning',
    packs: ['contentGrowth', 'recruitingOps', 'researchMonitoring'],
    scheduleExpr: '0 11 * * TUE,THU',
  },
  {
    id: 'saasUsageReview',
    category: 'review',
    packs: ['saasProduct'],
    scheduleExpr: '0 10 * * MON-FRI',
  },
  {
    id: 'backlogPrioritization',
    category: 'planning',
    packs: ['saasProduct'],
    scheduleExpr: '30 15 * * TUE,THU',
  },
  {
    id: 'contentCalendar',
    category: 'planning',
    packs: ['contentGrowth'],
    scheduleExpr: '0 10 * * MON,WED,FRI',
  },
  {
    id: 'growthExperimentReview',
    category: 'review',
    packs: ['contentGrowth'],
    scheduleExpr: '0 17 * * WED',
  },
  {
    id: 'candidatePipelineReview',
    category: 'operations',
    packs: ['recruitingOps'],
    scheduleExpr: '0 10 * * MON-FRI',
  },
  {
    id: 'interviewFeedbackDigest',
    category: 'review',
    packs: ['recruitingOps'],
    scheduleExpr: '0 18 * * MON-FRI',
  },
  {
    id: 'staleDealAlert',
    category: 'operations',
    packs: ['salesFollowUp'],
    scheduleExpr: '30 14 * * MON-FRI',
  },
  {
    id: 'policySignalWatch',
    category: 'research',
    packs: ['researchMonitoring'],
    scheduleExpr: '30 8 * * MON-FRI',
  },
  {
    id: 'endOfDayReview',
    category: 'review',
    packs: ['saasProduct', 'recruitingOps', 'salesFollowUp'],
    scheduleExpr: '30 18 * * MON-FRI',
  },
  {
    id: 'userFeedbackDigest',
    category: 'review',
    packs: ['saasProduct', 'contentGrowth', 'recruitingOps', 'researchMonitoring'],
    scheduleExpr: '0 16 * * MON-FRI',
  },
  {
    id: 'weeklyReview',
    category: 'reporting',
    packs: ['saasProduct', 'contentGrowth', 'recruitingOps', 'salesFollowUp', 'researchMonitoring'],
    scheduleExpr: '30 17 * * FRI',
  },
  {
    id: 'leadFollowUp',
    category: 'operations',
    packs: ['salesFollowUp', 'recruitingOps', 'saasProduct'],
    scheduleExpr: '30 10 * * MON-FRI',
  },
];

export type CronDirectCreateContext = {
  conversationId: string;
  conversationTitle: string;
  workspacePath?: string;
  agentType: AcpBackendAll;
};

export function buildCronPresetPrompt(
  t: TranslateFn,
  values: {
    name: string;
    scheduleDescription: string;
    message: string;
  }
): string {
  return t('schedule.presets.fillTemplate', {
    name: values.name,
    scheduleDescription: values.scheduleDescription,
    message: values.message,
  });
}

export function getSchedulePresets(t: TranslateFn): CronPreset[] {
  return CRON_PRESET_SEEDS.map((preset) => {
    const name = t(`schedule.presets.items.${preset.id}.name`);
    const description = t(`schedule.presets.items.${preset.id}.description`);
    const scheduleDescription = t(`schedule.presets.items.${preset.id}.scheduleDescription`);
    const message = t(`schedule.presets.items.${preset.id}.message`);

    return {
      id: preset.id,
      category: preset.category,
      packs: preset.packs,
      name,
      description,
      schedule: {
        expr: preset.scheduleExpr,
        description: scheduleDescription,
      },
      message,
      prompt: buildCronPresetPrompt(t, {
        name,
        scheduleDescription,
        message,
      }),
    };
  });
}

export function filterCronPresetsByPack(presets: CronPreset[], pack: CronPresetPack | 'all'): CronPreset[] {
  if (pack === 'all') {
    return presets;
  }

  return presets.filter((preset) => preset.packs.includes(pack));
}

export function getScheduleDirectCreateContext(
  conversation: TChatConversation | undefined
): CronDirectCreateContext | null {
  if (!conversation) {
    return null;
  }

  switch (conversation.type) {
    case 'gemini':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        workspacePath: conversation.extra.workingDirectory || conversation.extra.workspace,
        agentType: 'gemini',
      };
    case 'acp':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        workspacePath: conversation.extra.workingDirectory || conversation.extra.workspace,
        agentType: conversation.extra.backend,
      };
    case 'codex':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        workspacePath: conversation.extra.workingDirectory || conversation.extra.workspace,
        agentType: 'codex',
      };
    case 'openclaw-gateway':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        workspacePath: conversation.extra.workingDirectory || conversation.extra.workspace,
        agentType: conversation.extra.backend || 'openclaw-gateway',
      };
    case 'nanobot':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        workspacePath: conversation.extra.workingDirectory || conversation.extra.workspace,
        agentType: 'nanobot',
      };
    default:
      return null;
  }
}
