import type {
  AgentPackageCommandsPayload,
  AgentPackageManifest,
  AgentPackageSchedulesPayload,
  AgentPackageWorkspaceAutomationProfile,
} from '@/common/config/presets/agentPackageManifest';
import type { BundledAgentPackageDescriptor } from '@/common/config/presets/bundledAgentPackageRegistry';
import type {
  AssistantListItem,
  RelevantAssistantHook,
  RelevantAssistantSkill,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import type { AgentDetailTabId } from './constants';

export type AssistantPackageDocument = {
  id: string;
  title: string;
  relativePath: string;
  sourcePath: string;
  content: string;
};

export type AssistantPackageDocTreeNode = {
  id: string;
  label: string;
  path?: string;
  children: AssistantPackageDocTreeNode[];
};

export type AssistantWorkspaceCommandItem = {
  id: string;
  label: string;
  summary: string;
  profile: AgentPackageWorkspaceAutomationProfile;
  installSurface: AgentPackageCommandsPayload['installSurface'];
  commandId: string;
  template: string;
  enabled: boolean;
  sourceKind: 'builtin' | 'custom';
};

export type AssistantWorkspaceScheduleItem = {
  id: string;
  label: string;
  summary: string;
  profile: AgentPackageWorkspaceAutomationProfile;
  installSurface: AgentPackageSchedulesPayload['installSurface'];
  runtimeSurface: string;
  entryCount: number;
  payloadPreview: string;
};

export type AssistantWorkspaceModel = {
  assistant: AssistantListItem;
  packageAssistantId?: string;
  packageDescriptor?: BundledAgentPackageDescriptor;
  packageManifest?: AgentPackageManifest;
  agentsDocument: AssistantPackageDocument | null;
  docs: AssistantPackageDocument[];
  docsTree: AssistantPackageDocTreeNode[];
  commands: AssistantWorkspaceCommandItem[];
  schedules: AssistantWorkspaceScheduleItem[];
  relevantSkills: RelevantAssistantSkill[];
  relevantHooks: RelevantAssistantHook[];
  availableTabs: AgentDetailTabId[];
  defaultTab: AgentDetailTabId | null;
  isEditable: boolean;
};
