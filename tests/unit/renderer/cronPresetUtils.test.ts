import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import {
  buildCronPresetPrompt,
  filterCronPresetsByPack,
  getScheduleDirectCreateContext,
  getSchedulePresets,
} from '@/renderer/pages/schedule/schedulePresetUtils';

const translations: Record<string, string> = {
  'schedule.presets.fillTemplate': 'Create {{name}} at {{scheduleDescription}} with {{message}}',
  'schedule.presets.items.aiDigest.name': 'AI News Digest',
  'schedule.presets.items.aiDigest.description': 'Track fresh AI updates',
  'schedule.presets.items.aiDigest.scheduleDescription': 'Every weekday at 09:00',
  'schedule.presets.items.aiDigest.message': 'Summarize top AI signals',
  'schedule.presets.items.competitorWatch.name': 'Competitor Watch',
  'schedule.presets.items.competitorWatch.description': 'Watch competitor changes',
  'schedule.presets.items.competitorWatch.scheduleDescription': 'Every weekday at 14:00',
  'schedule.presets.items.competitorWatch.message': 'Summarize competitor moves',
  'schedule.presets.items.morningFocus.name': 'Morning Focus Plan',
  'schedule.presets.items.morningFocus.description': 'Prioritize the workday',
  'schedule.presets.items.morningFocus.scheduleDescription': 'Every weekday at 09:30',
  'schedule.presets.items.morningFocus.message': "List today's priorities",
  'schedule.presets.items.contentRadar.name': 'Content Idea Radar',
  'schedule.presets.items.contentRadar.description': 'Generate content ideas',
  'schedule.presets.items.contentRadar.scheduleDescription': 'Every Tuesday and Thursday at 11:00',
  'schedule.presets.items.contentRadar.message': 'Generate content ideas',
  'schedule.presets.items.saasUsageReview.name': 'Active User Shift Review',
  'schedule.presets.items.saasUsageReview.description': 'Review active-user movement',
  'schedule.presets.items.saasUsageReview.scheduleDescription': 'Every weekday at 10:00',
  'schedule.presets.items.saasUsageReview.message': 'Review active-user changes',
  'schedule.presets.items.backlogPrioritization.name': 'Backlog Priority Review',
  'schedule.presets.items.backlogPrioritization.description': 'Re-check the product backlog',
  'schedule.presets.items.backlogPrioritization.scheduleDescription': 'Every Tuesday and Thursday at 15:30',
  'schedule.presets.items.backlogPrioritization.message': 'Reassess backlog priority',
  'schedule.presets.items.contentCalendar.name': 'Content Calendar Review',
  'schedule.presets.items.contentCalendar.description': 'Review upcoming publishing plans',
  'schedule.presets.items.contentCalendar.scheduleDescription': 'Every Monday, Wednesday, and Friday at 10:00',
  'schedule.presets.items.contentCalendar.message': 'Suggest a short-term publishing calendar',
  'schedule.presets.items.growthExperimentReview.name': 'Growth Experiment Review',
  'schedule.presets.items.growthExperimentReview.description': 'Review growth experiments',
  'schedule.presets.items.growthExperimentReview.scheduleDescription': 'Every Wednesday at 17:00',
  'schedule.presets.items.growthExperimentReview.message': 'Review the growth experiments',
  'schedule.presets.items.candidatePipelineReview.name': 'Candidate Pipeline Review',
  'schedule.presets.items.candidatePipelineReview.description': 'Review stage distribution and blockers',
  'schedule.presets.items.candidatePipelineReview.scheduleDescription': 'Every weekday at 10:00',
  'schedule.presets.items.candidatePipelineReview.message': 'Build a candidate pipeline review',
  'schedule.presets.items.interviewFeedbackDigest.name': 'Interview Feedback Digest',
  'schedule.presets.items.interviewFeedbackDigest.description': 'Summarize interview feedback',
  'schedule.presets.items.interviewFeedbackDigest.scheduleDescription': 'Every weekday at 18:00',
  'schedule.presets.items.interviewFeedbackDigest.message': "Summarize today's interview feedback",
  'schedule.presets.items.staleDealAlert.name': 'Stale Deal Alert',
  'schedule.presets.items.staleDealAlert.description': 'Identify stalled opportunities',
  'schedule.presets.items.staleDealAlert.scheduleDescription': 'Every weekday at 14:30',
  'schedule.presets.items.staleDealAlert.message': 'Identify stale deals',
  'schedule.presets.items.policySignalWatch.name': 'Policy Signal Watch',
  'schedule.presets.items.policySignalWatch.description': 'Track policy and regulatory signals',
  'schedule.presets.items.policySignalWatch.scheduleDescription': 'Every weekday at 08:30',
  'schedule.presets.items.policySignalWatch.message': 'Track policy and regulatory updates',
  'schedule.presets.items.endOfDayReview.name': 'End-of-Day Review',
  'schedule.presets.items.endOfDayReview.description': 'Wrap the workday',
  'schedule.presets.items.endOfDayReview.scheduleDescription': 'Every weekday at 18:30',
  'schedule.presets.items.endOfDayReview.message': "Review today's progress",
  'schedule.presets.items.userFeedbackDigest.name': 'User Feedback Digest',
  'schedule.presets.items.userFeedbackDigest.description': 'Summarize user issues',
  'schedule.presets.items.userFeedbackDigest.scheduleDescription': 'Every weekday at 16:00',
  'schedule.presets.items.userFeedbackDigest.message': 'Summarize user feedback',
  'schedule.presets.items.weeklyReview.name': 'Friday Weekly Report',
  'schedule.presets.items.weeklyReview.description': 'Prepare the weekly recap',
  'schedule.presets.items.weeklyReview.scheduleDescription': 'Every Friday at 17:30',
  'schedule.presets.items.weeklyReview.message': 'Prepare the weekly report',
  'schedule.presets.items.leadFollowUp.name': 'Lead Follow-Up Queue',
  'schedule.presets.items.leadFollowUp.description': 'Prioritize lead follow-ups',
  'schedule.presets.items.leadFollowUp.scheduleDescription': 'Every weekday at 10:30',
  'schedule.presets.items.leadFollowUp.message': 'List lead follow-ups',
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

describe('getSchedulePresets', () => {
  it('returns localized presets with fill prompts', () => {
    const presets = getSchedulePresets(t);

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
    const presets = getSchedulePresets(t);

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
    const presets = getSchedulePresets(t);

    expect(filterCronPresetsByPack(presets, 'all')).toEqual(presets);
  });
});

describe('getScheduleDirectCreateContext', () => {
  it('returns backend-aware creation context for supported conversations', () => {
    expect(getScheduleDirectCreateContext(createConversation())).toEqual({
      conversationId: 'conv-1',
      conversationTitle: 'Workspace Alpha',
      workspacePath: '/tmp/workspace-alpha',
      agentType: 'claude',
    });

    expect(
      getScheduleDirectCreateContext(
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
      getScheduleDirectCreateContext(
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
