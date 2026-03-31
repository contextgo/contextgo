/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import type { AcpBackendAll } from '@/common/types/acpTypes';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export type CronPresetId =
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
export type CronPresetRole = 'product' | 'content' | 'operations' | 'sales' | 'research';
export type CronPresetPack = 'saasProduct' | 'contentGrowth' | 'recruitingOps' | 'salesFollowUp' | 'researchMonitoring';

export type CronPreset = {
  id: CronPresetId;
  category: CronPresetCategory;
  packs: CronPresetPack[];
  roles: CronPresetRole[];
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

export const CRON_PRESET_ROLE_ORDER: CronPresetRole[] = ['product', 'content', 'operations', 'sales', 'research'];
export const CRON_PRESET_PACK_ORDER: CronPresetPack[] = [
  'saasProduct',
  'contentGrowth',
  'recruitingOps',
  'salesFollowUp',
  'researchMonitoring',
];
export const DEFAULT_CRON_PRESET_PACK: CronPresetPack = 'saasProduct';
export const DEFAULT_CRON_PRESET_HERO_IDS: CronPresetId[] = [
  'morningFocus',
  'saasUsageReview',
  'backlogPrioritization',
  'competitorWatch',
  'userFeedbackDigest',
  'weeklyReview',
];

type CronPresetSeed = {
  id: CronPresetId;
  category: CronPresetCategory;
  packs: CronPresetPack[];
  roles: CronPresetRole[];
  scheduleExpr: string;
};

const CRON_PRESET_SEEDS: CronPresetSeed[] = [
  {
    id: 'aiDigest',
    category: 'research',
    packs: ['saasProduct', 'contentGrowth', 'researchMonitoring'],
    roles: ['research', 'product', 'content'],
    scheduleExpr: '0 9 * * MON-FRI',
  },
  {
    id: 'competitorWatch',
    category: 'research',
    packs: ['saasProduct', 'contentGrowth', 'salesFollowUp', 'researchMonitoring'],
    roles: ['product', 'operations', 'research'],
    scheduleExpr: '0 14 * * MON-FRI',
  },
  {
    id: 'morningFocus',
    category: 'planning',
    packs: ['saasProduct', 'recruitingOps', 'salesFollowUp'],
    roles: ['product', 'operations', 'content'],
    scheduleExpr: '30 9 * * MON-FRI',
  },
  {
    id: 'contentRadar',
    category: 'planning',
    packs: ['contentGrowth', 'recruitingOps', 'researchMonitoring'],
    roles: ['content', 'operations', 'research'],
    scheduleExpr: '0 11 * * TUE,THU',
  },
  {
    id: 'saasUsageReview',
    category: 'review',
    packs: ['saasProduct'],
    roles: ['product', 'operations', 'research'],
    scheduleExpr: '0 10 * * MON-FRI',
  },
  {
    id: 'backlogPrioritization',
    category: 'planning',
    packs: ['saasProduct'],
    roles: ['product', 'operations'],
    scheduleExpr: '30 15 * * TUE,THU',
  },
  {
    id: 'contentCalendar',
    category: 'planning',
    packs: ['contentGrowth'],
    roles: ['content', 'operations'],
    scheduleExpr: '0 10 * * MON,WED,FRI',
  },
  {
    id: 'growthExperimentReview',
    category: 'review',
    packs: ['contentGrowth'],
    roles: ['content', 'operations', 'research'],
    scheduleExpr: '0 17 * * WED',
  },
  {
    id: 'candidatePipelineReview',
    category: 'operations',
    packs: ['recruitingOps'],
    roles: ['operations', 'sales'],
    scheduleExpr: '0 10 * * MON-FRI',
  },
  {
    id: 'interviewFeedbackDigest',
    category: 'review',
    packs: ['recruitingOps'],
    roles: ['operations', 'product'],
    scheduleExpr: '0 18 * * MON-FRI',
  },
  {
    id: 'staleDealAlert',
    category: 'operations',
    packs: ['salesFollowUp'],
    roles: ['sales', 'operations'],
    scheduleExpr: '30 14 * * MON-FRI',
  },
  {
    id: 'policySignalWatch',
    category: 'research',
    packs: ['researchMonitoring'],
    roles: ['research', 'product'],
    scheduleExpr: '30 8 * * MON-FRI',
  },
  {
    id: 'endOfDayReview',
    category: 'review',
    packs: ['saasProduct', 'recruitingOps', 'salesFollowUp'],
    roles: ['product', 'operations', 'sales'],
    scheduleExpr: '30 18 * * MON-FRI',
  },
  {
    id: 'userFeedbackDigest',
    category: 'review',
    packs: ['saasProduct', 'contentGrowth', 'recruitingOps', 'researchMonitoring'],
    roles: ['product', 'operations', 'research'],
    scheduleExpr: '0 16 * * MON-FRI',
  },
  {
    id: 'weeklyReview',
    category: 'reporting',
    packs: ['saasProduct', 'contentGrowth', 'recruitingOps', 'salesFollowUp', 'researchMonitoring'],
    roles: ['product', 'operations', 'sales', 'content'],
    scheduleExpr: '30 17 * * FRI',
  },
  {
    id: 'leadFollowUp',
    category: 'operations',
    packs: ['salesFollowUp', 'recruitingOps', 'saasProduct'],
    roles: ['sales', 'operations', 'product'],
    scheduleExpr: '30 10 * * MON-FRI',
  },
];

export type CronDirectCreateContext = {
  conversationId: string;
  conversationTitle: string;
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
  return t('cron.presets.fillTemplate', {
    name: values.name,
    scheduleDescription: values.scheduleDescription,
    message: values.message,
  });
}

export function getCronPresets(t: TranslateFn): CronPreset[] {
  return CRON_PRESET_SEEDS.map((preset) => {
    const name = t(`cron.presets.items.${preset.id}.name`);
    const description = t(`cron.presets.items.${preset.id}.description`);
    const scheduleDescription = t(`cron.presets.items.${preset.id}.scheduleDescription`);
    const message = t(`cron.presets.items.${preset.id}.message`);

    return {
      id: preset.id,
      category: preset.category,
      packs: preset.packs,
      roles: preset.roles,
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

export function filterCronPresetsByRole(presets: CronPreset[], role: CronPresetRole | 'all'): CronPreset[] {
  if (role === 'all') {
    return presets;
  }

  return presets.filter((preset) => preset.roles.includes(role));
}

export function filterCronPresetsByPack(presets: CronPreset[], pack: CronPresetPack | 'all'): CronPreset[] {
  if (pack === 'all') {
    return presets;
  }

  return presets.filter((preset) => preset.packs.includes(pack));
}

export function getCronDirectCreateContext(
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
        agentType: 'gemini',
      };
    case 'acp':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        agentType: conversation.extra.backend,
      };
    case 'codex':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        agentType: 'codex',
      };
    case 'openclaw-gateway':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        agentType: conversation.extra.backend || 'openclaw-gateway',
      };
    case 'nanobot':
      return {
        conversationId: conversation.id,
        conversationTitle: conversation.name,
        agentType: 'nanobot',
      };
    default:
      return null;
  }
}
