import type { Message } from '@arco-design/web-react';
import type { AcpBackendConfig } from '@/common/types/acpTypes';
import type { HookInfo as SharedHookInfo } from '@/common/types/hookTypes';

// Skill info type
export type SkillInfo = {
  name: string;
  description: string;
  location: string;
  isCustom: boolean;
};

export type HookInfo = SharedHookInfo;

export type ExternalSkillCandidate = {
  name: string;
  description: string;
  path: string;
};

// External source type
export type ExternalSource = {
  name: string;
  path: string;
  source: string;
  skills: ExternalSkillCandidate[];
};

export type SkillMarketArchive = {
  source: string;
  relativePath: string;
  label?: string;
};

export type SkillMarketView = 'curated' | 'full';

export type SkillMarketTopIndustry = {
  id: string;
  label: string;
  count: number;
};

export type SkillMarketTopCapability = {
  label: string;
  count: number;
};

export type SkillMarketStats = {
  total: number;
  categories: string[];
  sources: Record<string, number>;
  sourceTotal: number;
  reducedCount: number;
  reductionRatio: number;
  clusterCount: number;
  topIndustries: SkillMarketTopIndustry[];
  topCapabilities: SkillMarketTopCapability[];
  generatedAt?: string;
};

export type SkillMarketItem = {
  id: string;
  name: string;
  displayName: string;
  version: string;
  author: string;
  description: string;
  categories: string[];
  tags: string[];
  themes: string[];
  industries: string[];
  primaryCapability?: string;
  selectionReason?: string;
  homepage?: string;
  readmeUrl?: string;
  archives: SkillMarketArchive[];
  popularity: number;
  qualityScore: number;
  installs: number;
  stars: number;
};

export type SkillMarketIndustry = {
  id: string;
  label: string;
  summary: string;
  problems: string[];
  useCases: string[];
  outcomes: string[];
  workflow: string[];
  count: number;
  topThemes: string[];
  bundleIds: string[];
  recommendedSkills: SkillMarketItem[];
};

export type SkillMarketBundleStep = {
  label: string;
  themes: string[];
  skillIds: string[];
  skills: SkillMarketItem[];
};

export type SkillMarketBundle = {
  id: string;
  title: string;
  summary: string;
  industries: string[];
  forTeams: string;
  deliverables: string[];
  valuePoints: string[];
  steps: SkillMarketBundleStep[];
  skills: SkillMarketItem[];
};

export type AddableSkill =
  | ({ source: 'external' } & ExternalSkillCandidate)
  | ({ source: 'skill-market' } & SkillMarketItem);

// Pending skill to import
export type PendingSkill =
  | {
      source: 'external';
      path: string;
      name: string;
      description: string;
    }
  | {
      source: 'skill-market';
      name: string;
      description: string;
      marketSkillId: string;
      archive?: SkillMarketArchive;
    };

export type RelevantAssistantSkill = {
  name: string;
  description: string;
  isCustom: boolean;
  isPending: boolean;
};

export type RelevantAssistantHook = {
  name: string;
  description?: string;
  isCustom: boolean;
  hook?: HookInfo;
};

export type AssistantManagementProps = {
  message: ReturnType<typeof Message.useMessage>[0];
};

export type AssistantListItem = AcpBackendConfig & {
  _source?: string;
  _extensionName?: string;
  _kind?: string;
};

export type AssistantBadge = {
  key: string;
  label: string;
  tone: 'blue' | 'green' | 'gold';
};
