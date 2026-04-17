import { ASSISTANT_PRESETS } from '@/common/config/presets/assistantPresets';
import {
  getBundledAgentPackageDefaultEnabledHookNames,
  getBundledAgentPackageDefaultEnabledSkillNames,
  getBundledAgentPackageDocsRoot,
  getBundledAgentPackageEntryDocumentFile,
  getBundledAgentPackageWorkspaceAutomationProfile,
} from '@/common/config/presets/bundledAgentPackageRegistry';
import { getWorkspaceAutomationProfileDefinition } from '@/common/config/presets/workspaceAutomationProfiles';
import type { PresetAgentType } from '@/common/types/acpTypes';
import type { AgentPackageWorkspaceAutomationProfile } from '@/common/config/presets/agentPackageManifest';

export type AgentCreateStepId = 'define-work' | 'capability-stack' | 'runtime-automation' | 'review' | 'done';

export type AgentCreateIntentDraft = {
  workDescription: string;
  audience: string;
  output: string;
  workStyle: 'analyze' | 'create' | 'execute' | 'maintain';
  recurrence: 'one-off' | 'frequent' | 'continuous';
};

export type AgentCapabilityRecommendation = {
  linkedPackagePresetId: string | null;
  packageLabel: string;
  packageDescription: string;
  defaultSkills: string[];
  defaultHooks: string[];
  commandCount: number;
  scheduleCount: number;
  docsCount: number;
  agentsDocumentAvailable: boolean;
  runtime: PresetAgentType;
  reasons: string[];
};

export type AgentCreateFlowSummary = {
  title: string;
  description: string;
  workSummary: string;
  runtimeLabel: string;
  capabilityCountLabel: string;
  automationLabel: string;
};

type RecommendationProfile = {
  presetId: string;
  keywords: string[];
  styles?: AgentCreateIntentDraft['workStyle'][];
  recurrence?: AgentCreateIntentDraft['recurrence'][];
  reasons: string[];
};

const RECOMMENDATION_PROFILES: RecommendationProfile[] = [
  {
    presetId: 'pm-workbench',
    keywords: ['prd', 'roadmap', 'product', 'discovery', 'priorit', 'backlog', 'requirement'],
    styles: ['analyze', 'maintain'],
    recurrence: ['frequent', 'continuous'],
    reasons: ['Best fit for product planning, roadmap, and PRD work.'],
  },
  {
    presetId: 'finance-analyst',
    keywords: ['finance', 'financial', 'budget', 'variance', 'valuation', 'revenue', 'cash', 'statement'],
    styles: ['analyze'],
    recurrence: ['frequent', 'continuous'],
    reasons: ['Best fit for finance review, variance analysis, and planning loops.'],
  },
  {
    presetId: 'office-analyst',
    keywords: ['spreadsheet', 'excel', 'report', 'document', 'reconcile', 'cross-check', 'office'],
    styles: ['analyze', 'execute'],
    recurrence: ['frequent'],
    reasons: ['Best fit for spreadsheet analysis, document synthesis, and reporting.'],
  },
  {
    presetId: 'design-director',
    keywords: ['design', 'ui', 'ux', 'visual', 'art direction', 'screenshot', 'critique', 'reference'],
    styles: ['create', 'analyze'],
    reasons: ['Best fit for design direction, critique, and implementation handoff.'],
  },
  {
    presetId: 'figma-closed-loop',
    keywords: [
      'figma',
      'figma sync',
      'figma library',
      'design system sync',
      'design tokens sync',
      'implementation handoff',
      'design drift',
      'figma node',
      'figma file',
    ],
    styles: ['create', 'execute', 'maintain'],
    reasons: ['Best fit for code <-> Figma <-> code execution loop, library sync, and drift audit.'],
  },
  {
    presetId: 'marketing-creative-studio',
    keywords: [
      'marketing',
      'campaign',
      'creative',
      'brand',
      'social',
      'ads',
      'paid ad',
      'launch',
      'ecommerce',
      'growth',
      'copy',
      'variant',
    ],
    styles: ['create'],
    recurrence: ['frequent', 'continuous'],
    reasons: ['Best fit for campaign creative production, brand consistency, and multi-channel asset variants.'],
  },
  {
    presetId: 'motion-studio',
    keywords: ['motion', 'video', 'storyboard', 'scene', 'render', 'cutdown', 'animation', 'subtitle', 'caption', 'qc'],
    styles: ['create', 'execute'],
    recurrence: ['frequent', 'continuous'],
    reasons: ['Best fit for storyboard planning, code-driven rendering, and motion QC workflows.'],
  },
  {
    presetId: 'startup-strategist',
    keywords: ['startup', 'gtm', 'icp', 'founder', 'market', 'beachhead', 'value proposition'],
    styles: ['analyze', 'create'],
    reasons: ['Best fit for startup strategy, positioning, and GTM definition.'],
  },
  {
    presetId: 'morph-ppt',
    keywords: ['ppt', 'slides', 'deck', 'presentation', 'powerpoint'],
    styles: ['create'],
    reasons: ['Best fit for building presentation decks and slide narratives.'],
  },
];

const fallbackProfile = RECOMMENDATION_PROFILES[0];

const toBuiltinAssistantId = (presetId: string): string => `builtin-${presetId}`;

const getPresetMeta = (presetId: string) => {
  return ASSISTANT_PRESETS.find((preset) => preset.id === presetId);
};

const scoreRecommendation = (draft: AgentCreateIntentDraft, profile: RecommendationProfile): number => {
  const corpus = [draft.workDescription, draft.audience, draft.output].join(' ').toLowerCase();
  let score = 0;

  for (const keyword of profile.keywords) {
    if (corpus.includes(keyword)) {
      score += 3;
    }
  }

  if (profile.styles?.includes(draft.workStyle)) {
    score += 2;
  }

  if (profile.recurrence?.includes(draft.recurrence)) {
    score += 1;
  }

  return score;
};

const resolveRecommendationProfile = (draft: AgentCreateIntentDraft): RecommendationProfile => {
  const scored = RECOMMENDATION_PROFILES.map((profile) => ({
    profile,
    score: scoreRecommendation(draft, profile),
  })).toSorted((left, right) => right.score - left.score);

  return scored[0]?.score > 0 ? scored[0].profile : fallbackProfile;
};

export const buildCapabilityRecommendation = (draft: AgentCreateIntentDraft): AgentCapabilityRecommendation => {
  const profile = resolveRecommendationProfile(draft);
  const presetMeta = getPresetMeta(profile.presetId);
  const linkedPackagePresetId = toBuiltinAssistantId(profile.presetId);
  const automationProfile = getBundledAgentPackageWorkspaceAutomationProfile(linkedPackagePresetId) as
    | AgentPackageWorkspaceAutomationProfile
    | undefined;
  const automationDefinition = automationProfile ? getWorkspaceAutomationProfileDefinition(automationProfile) : null;

  return {
    linkedPackagePresetId,
    packageLabel: presetMeta?.nameI18n['en-US'] ?? profile.presetId,
    packageDescription: presetMeta?.descriptionI18n['en-US'] ?? '',
    defaultSkills: getBundledAgentPackageDefaultEnabledSkillNames(linkedPackagePresetId) ?? [],
    defaultHooks: getBundledAgentPackageDefaultEnabledHookNames(linkedPackagePresetId) ?? [],
    commandCount: automationDefinition?.commandSeeds.length ?? 0,
    scheduleCount: automationDefinition?.scheduleSeed.conversationSchedules.length ?? 0,
    docsCount: getBundledAgentPackageDocsRoot(linkedPackagePresetId) ? 1 : 0,
    agentsDocumentAvailable: Boolean(getBundledAgentPackageEntryDocumentFile(linkedPackagePresetId)),
    runtime: presetMeta?.presetAgentType ?? 'gemini',
    reasons: profile.reasons,
  };
};

export const buildCreateFlowSummary = (args: {
  recommendation: AgentCapabilityRecommendation;
  editName: string;
  editDescription: string;
  workDescription: string;
  workStyle: AgentCreateIntentDraft['workStyle'];
  recurrence: AgentCreateIntentDraft['recurrence'];
}): AgentCreateFlowSummary => {
  const capabilityCount = args.recommendation.defaultSkills.length + args.recommendation.defaultHooks.length;

  return {
    title: args.editName.trim() || args.recommendation.packageLabel,
    description: args.editDescription.trim() || args.recommendation.packageDescription,
    workSummary: `${args.workDescription.trim()} · ${args.workStyle} · ${args.recurrence}`,
    runtimeLabel: args.recommendation.runtime,
    capabilityCountLabel: `${args.recommendation.defaultSkills.length} skills · ${args.recommendation.defaultHooks.length} hooks (${capabilityCount} total)`,
    automationLabel: `${args.recommendation.commandCount} commands · ${args.recommendation.scheduleCount} schedules`,
  };
};
