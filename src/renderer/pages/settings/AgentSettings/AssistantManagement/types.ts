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

export type SkillMarketItem = {
  id: string;
  name: string;
  displayName: string;
  version: string;
  author: string;
  description: string;
  categories: string[];
  tags: string[];
  homepage?: string;
  readmeUrl?: string;
  archives: SkillMarketArchive[];
  popularity: number;
  installs: number;
  stars: number;
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

export type AssistantManagementProps = {
  message: ReturnType<typeof Message.useMessage>[0];
};

export type AssistantListItem = AcpBackendConfig & {
  _source?: string;
  _extensionName?: string;
  _kind?: string;
};
