import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import {
  buildCronPresetPrompt,
  filterCronPresetsByPack,
  getCronDirectCreateContext,
  getCronPresets,
} from '@/renderer/pages/cron/cronPresetUtils';

const translations: Record<string, string> = {
  'cron.presets.fillTemplate': 'Create {{name}} at {{scheduleDescription}} with {{message}}',
  'cron.presets.items.aiDigest.name': 'AI News Digest',
  'cron.presets.items.aiDigest.description': 'Track fresh AI updates',
  'cron.presets.items.aiDigest.scheduleDescription': 'Every weekday at 09:00',
  'cron.presets.items.aiDigest.message': 'Summarize top AI signals',
  'cron.presets.items.competitorWatch.name': 'Competitor Watch',
  'cron.presets.items.competitorWatch.description': 'Watch competitor changes',
  'cron.presets.items.competitorWatch.scheduleDescription': 'Every weekday at 14:00',
  'cron.presets.items.competitorWatch.message': 'Summarize competitor moves',
  'cron.presets.items.morningFocus.name': 'Morning Focus Plan',
  'cron.presets.items.morningFocus.description': 'Prioritize the workday',
  'cron.presets.items.morningFocus.scheduleDescription': 'Every weekday at 09:30',
  'cron.presets.items.morningFocus.message': "List today's priorities",
  'cron.presets.items.contentRadar.name': 'Content Idea Radar',
  'cron.presets.items.contentRadar.description': 'Generate content ideas',
  'cron.presets.items.contentRadar.scheduleDescription': 'Every Tuesday and Thursday at 11:00',
  'cron.presets.items.contentRadar.message': 'Generate content ideas',
  'cron.presets.items.saasUsageReview.name': 'Active User Shift Review',
  'cron.presets.items.saasUsageReview.description': 'Review active-user movement',
  'cron.presets.items.saasUsageReview.scheduleDescription': 'Every weekday at 10:00',
  'cron.presets.items.saasUsageReview.message': 'Review active-user changes',
  'cron.presets.items.backlogPrioritization.name': 'Backlog Priority Review',
  'cron.presets.items.backlogPrioritization.description': 'Re-check the product backlog',
  'cron.presets.items.backlogPrioritization.scheduleDescription': 'Every Tuesday and Thursday at 15:30',
  'cron.presets.items.backlogPrioritization.message': 'Reassess backlog priority',
  'cron.presets.items.contentCalendar.name': 'Content Calendar Review',
  'cron.presets.items.contentCalendar.description': 'Review upcoming publishing plans',
  'cron.presets.items.contentCalendar.scheduleDescription': 'Every Monday, Wednesday, and Friday at 10:00',
  'cron.presets.items.contentCalendar.message': 'Suggest a short-term publishing calendar',
  'cron.presets.items.growthExperimentReview.name': 'Growth Experiment Review',
  'cron.presets.items.growthExperimentReview.description': 'Review growth experiments',
  'cron.presets.items.growthExperimentReview.scheduleDescription': 'Every Wednesday at 17:00',
  'cron.presets.items.growthExperimentReview.message': 'Review the growth experiments',
  'cron.presets.items.candidatePipelineReview.name': 'Candidate Pipeline Review',
  'cron.presets.items.candidatePipelineReview.description': 'Review stage distribution and blockers',
  'cron.presets.items.candidatePipelineReview.scheduleDescription': 'Every weekday at 10:00',
  'cron.presets.items.candidatePipelineReview.message': 'Build a candidate pipeline review',
  'cron.presets.items.interviewFeedbackDigest.name': 'Interview Feedback Digest',
  'cron.presets.items.interviewFeedbackDigest.description': 'Summarize interview feedback',
  'cron.presets.items.interviewFeedbackDigest.scheduleDescription': 'Every weekday at 18:00',
  'cron.presets.items.interviewFeedbackDigest.message': "Summarize today's interview feedback",
  'cron.presets.items.staleDealAlert.name': 'Stale Deal Alert',
  'cron.presets.items.staleDealAlert.description': 'Identify stalled opportunities',
  'cron.presets.items.staleDealAlert.scheduleDescription': 'Every weekday at 14:30',
  'cron.presets.items.staleDealAlert.message': 'Identify stale deals',
  'cron.presets.items.policySignalWatch.name': 'Policy Signal Watch',
  'cron.presets.items.policySignalWatch.description': 'Track policy and regulatory signals',
  'cron.presets.items.policySignalWatch.scheduleDescription': 'Every weekday at 08:30',
  'cron.presets.items.policySignalWatch.message': 'Track policy and regulatory updates',
  'cron.presets.items.endOfDayReview.name': 'End-of-Day Review',
  'cron.presets.items.endOfDayReview.description': 'Wrap the workday',
  'cron.presets.items.endOfDayReview.scheduleDescription': 'Every weekday at 18:30',
  'cron.presets.items.endOfDayReview.message': "Review today's progress",
  'cron.presets.items.userFeedbackDigest.name': 'User Feedback Digest',
  'cron.presets.items.userFeedbackDigest.description': 'Summarize user issues',
  'cron.presets.items.userFeedbackDigest.scheduleDescription': 'Every weekday at 16:00',
  'cron.presets.items.userFeedbackDigest.message': 'Summarize user feedback',
  'cron.presets.items.weeklyReview.name': 'Friday Weekly Report',
  'cron.presets.items.weeklyReview.description': 'Prepare the weekly recap',
  'cron.presets.items.weeklyReview.scheduleDescription': 'Every Friday at 17:30',
  'cron.presets.items.weeklyReview.message': 'Prepare the weekly report',
  'cron.presets.items.leadFollowUp.name': 'Lead Follow-Up Queue',
  'cron.presets.items.leadFollowUp.description': 'Prioritize lead follow-ups',
  'cron.presets.items.leadFollowUp.scheduleDescription': 'Every weekday at 10:30',
  'cron.presets.items.leadFollowUp.message': 'List lead follow-ups',
};

const t = (key: string, options?: Record<string, unknown>) => {
  const template = translations[key] ?? key;
  return Object.entries(options || {}).reduce(
    (result, [name, value]) => result.replaceAll(`{{${name}}}`, String(value)),
    template
  );
};

const createConversation = (overrides: Partial<TChatConversation> = {}): TChatConversation =>
  ({
    id: 'conv-1',
    name: 'Workspace Alpha',
    type: 'acp',
    createTime: 1,
    modifyTime: 1,
    extra: {
      backend: 'claude',
      workspace: '/tmp/workspace-alpha',
    },
    status: 'finished',
    ...overrides,
  }) as TChatConversation;

describe('getCronPresets', () => {
  it('returns localized presets with fill prompts', () => {
    const presets = getCronPresets(t);

    expect(presets).toHaveLength(16);
    expect(presets[0]).toMatchObject({
      id: 'aiDigest',
      name: 'AI News Digest',
      prompt: 'Create AI News Digest at Every weekday at 09:00 with Summarize top AI signals',
    });
    expect(presets[1]).toMatchObject({
      id: 'competitorWatch',
      schedule: {
        expr: '0 14 * * MON-FRI',
        description: 'Every weekday at 14:00',
      },
    });
    expect(presets[4]).toMatchObject({
      id: 'saasUsageReview',
      schedule: {
        expr: '0 10 * * MON-FRI',
        description: 'Every weekday at 10:00',
      },
    });
    expect(presets[11]).toMatchObject({
      id: 'policySignalWatch',
      schedule: {
        expr: '30 8 * * MON-FRI',
        description: 'Every weekday at 08:30',
      },
    });
    expect(presets[15]).toMatchObject({
      id: 'leadFollowUp',
      schedule: {
        expr: '30 10 * * MON-FRI',
        description: 'Every weekday at 10:30',
      },
    });
    expect(presets[14]).toMatchObject({
      id: 'weeklyReview',
      schedule: {
        expr: '30 17 * * FRI',
        description: 'Every Friday at 17:30',
      },
    });
  });
});

describe('buildCronPresetPrompt', () => {
  it('interpolates the preset metadata into the template', () => {
    expect(
      buildCronPresetPrompt(t, {
        name: 'Morning Focus Plan',
        scheduleDescription: 'Every weekday at 09:30',
        message: "List today's priorities",
      })
    ).toBe("Create Morning Focus Plan at Every weekday at 09:30 with List today's priorities");
  });
});

describe('filterCronPresetsByPack', () => {
  it('filters presets by the selected industry pack', () => {
    const presets = getCronPresets(t);

    expect(filterCronPresetsByPack(presets, 'salesFollowUp').map((preset) => preset.id)).toEqual([
      'competitorWatch',
      'morningFocus',
      'staleDealAlert',
      'endOfDayReview',
      'weeklyReview',
      'leadFollowUp',
    ]);
    expect(filterCronPresetsByPack(presets, 'researchMonitoring').map((preset) => preset.id)).toEqual([
      'aiDigest',
      'competitorWatch',
      'contentRadar',
      'policySignalWatch',
      'userFeedbackDigest',
      'weeklyReview',
    ]);
    expect(filterCronPresetsByPack(presets, 'saasProduct').map((preset) => preset.id)).toEqual([
      'aiDigest',
      'competitorWatch',
      'morningFocus',
      'saasUsageReview',
      'backlogPrioritization',
      'endOfDayReview',
      'userFeedbackDigest',
      'weeklyReview',
      'leadFollowUp',
    ]);
  });

  it('returns all presets when no industry pack filter is applied', () => {
    const presets = getCronPresets(t);

    expect(filterCronPresetsByPack(presets, 'all')).toEqual(presets);
  });
});

describe('getCronDirectCreateContext', () => {
  it('returns backend-aware creation context for supported conversations', () => {
    expect(getCronDirectCreateContext(createConversation())).toEqual({
      conversationId: 'conv-1',
      conversationTitle: 'Workspace Alpha',
      workspacePath: '/tmp/workspace-alpha',
      agentType: 'claude',
    });

    expect(
      getCronDirectCreateContext(
        createConversation({
          type: 'openclaw-gateway',
          extra: {
            backend: 'qwen',
            workspace: '/tmp/workspace-alpha',
          },
        })
      )
    ).toEqual({
      conversationId: 'conv-1',
      conversationTitle: 'Workspace Alpha',
      workspacePath: '/tmp/workspace-alpha',
      agentType: 'qwen',
    });
  });

  it('returns null for unsupported conversation types', () => {
    expect(
      getCronDirectCreateContext(
        createConversation({
          type: 'group',
          extra: {
            participants: [],
            orchestration: {
              mode: 'broadcast',
              rounds: 1,
            },
          },
        })
      )
    ).toBeNull();
  });
});
