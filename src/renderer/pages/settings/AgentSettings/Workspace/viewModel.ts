/// <reference types="vite/client" />

import {
  getWorkspaceAutomationProfileDefinition,
  getWorkspaceCommandSeedKind,
  materializeWorkspaceCommandSeed,
} from '@/common/config/presets/workspaceAutomationProfiles';
import {
  findBundledAgentPackageDescriptorByAssistantId,
  getBundledAgentPackageOwnedSkillNames,
  getBundledAgentPackagePayload,
} from '@/common/config/presets/bundledAgentPackageRegistry';
import type { AgentPackageManifest } from '@/common/config/presets/agentPackageManifest';
import {
  getRelevantAssistantHooks,
  getRelevantAssistantSkills,
  isExtensionAssistant,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils';
import type {
  AssistantListItem,
  HookInfo,
  PendingSkill,
  RelevantAssistantHook,
  RelevantAssistantSkill,
  SkillInfo,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import { AGENT_DETAIL_TAB_PRIORITY, type AgentDetailTabId } from './constants';
import type {
  AssistantPackageDocTreeNode,
  AssistantPackageDocument,
  AssistantWorkspaceCommandItem,
  AssistantWorkspaceModel,
  AssistantWorkspaceScheduleItem,
} from './types';

const ASSISTANT_MARKDOWN_RESOURCE_MARKER = 'process/resources/assistant/';

const normalizeBundledAssistantResourcePath = (value: string): string => value.replace(/\\/g, '/').replace(/^\/+/, '');

export const toProjectRelativeAssistantMarkdownPath = (value: string): string | null => {
  const normalizedPath = normalizeBundledAssistantResourcePath(value);
  const markerIndex = normalizedPath.indexOf(ASSISTANT_MARKDOWN_RESOURCE_MARKER);

  if (markerIndex < 0) {
    return null;
  }

  return `src/${normalizedPath.slice(markerIndex)}`;
};

export const toDocumentTitle = (document: AssistantPackageDocument): string => {
  const headingMatch = document.content.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].trim();
  }

  const fileName = document.relativePath.split('/').pop() || document.relativePath;
  return fileName.replace(/\.md$/i, '');
};

const sortDocTreeNodes = (nodes: AssistantPackageDocTreeNode[]): AssistantPackageDocTreeNode[] =>
  nodes
    .map((node) => ({
      ...node,
      children: sortDocTreeNodes(node.children),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

export const buildDocTree = (documents: AssistantPackageDocument[]): AssistantPackageDocTreeNode[] => {
  const root: AssistantPackageDocTreeNode = {
    id: 'root',
    label: 'root',
    children: [],
  };

  documents.forEach((document) => {
    const segments = document.relativePath.split('/').filter(Boolean);
    let cursor = root;

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1;
      const nodeId = segments.slice(0, index + 1).join('/');
      let nextNode = cursor.children.find((child) => child.id === nodeId);

      if (!nextNode) {
        nextNode = {
          id: nodeId,
          label: segment.replace(/\.md$/i, ''),
          path: isLeaf ? document.relativePath : undefined,
          children: [],
        };
        cursor.children.push(nextNode);
      }

      cursor = nextNode;
    });
  });

  return sortDocTreeNodes(root.children);
};

const buildCommandItems = (assistantId: string): AssistantWorkspaceCommandItem[] => {
  const payload = getBundledAgentPackagePayload(assistantId, 'commands');
  if (!payload || !('workspaceAutomationProfile' in payload)) {
    return [];
  }

  const profile = payload.workspaceAutomationProfile;
  const definition = getWorkspaceAutomationProfileDefinition(profile);
  if (!definition) {
    return [];
  }

  return definition.commandSeeds.map((seed) => {
    const command = materializeWorkspaceCommandSeed(seed);

    return {
      id: command.id,
      label: command.name,
      summary: command.description,
      profile,
      installSurface: payload.installSurface,
      commandId: command.id,
      template: command.template,
      enabled: command.enabled,
      sourceKind: getWorkspaceCommandSeedKind(seed),
    };
  });
};

const buildScheduleItems = (assistantId: string): AssistantWorkspaceScheduleItem[] => {
  const payload = getBundledAgentPackagePayload(assistantId, 'schedules');
  if (!payload || !('workspaceAutomationProfile' in payload)) {
    return [];
  }

  const profile = payload.workspaceAutomationProfile;
  const definition = getWorkspaceAutomationProfileDefinition(profile);
  if (!definition) {
    return [];
  }

  const entryCount = definition.scheduleSeed.conversationSchedules.length;
  if (entryCount === 0) {
    return [];
  }

  const payloadPreview = JSON.stringify(definition.scheduleSeed, null, 2);

  return [
    {
      id: `${profile}-conversation-schedules`,
      label: 'Conversation schedules',
      profile,
      installSurface: payload.installSurface,
      runtimeSurface: '.contextgo/schedules',
      entryCount,
      payloadPreview,
      summary:
        entryCount > 0
          ? `This package seeds ${entryCount} conversation schedule entries through the "${definition.label}" automation profile.`
          : `This package seeds the conversation schedule container through the "${definition.label}" automation profile.`,
    },
  ];
};

const buildRelevantSkills = ({
  assistantId,
  availableSkills,
  pendingSkills,
  selectedSkills,
}: {
  assistantId: string;
  availableSkills: SkillInfo[];
  pendingSkills: PendingSkill[];
  selectedSkills: string[];
}): RelevantAssistantSkill[] => {
  const packagedSkillNames = getBundledAgentPackageOwnedSkillNames(assistantId) ?? [];

  return getRelevantAssistantSkills({
    availableSkills,
    selectedSkills: [...new Set([...packagedSkillNames, ...selectedSkills])],
    pendingSkills,
  });
};

const buildRelevantHooks = ({
  availableHooks,
  selectedHooks,
}: {
  availableHooks: HookInfo[];
  selectedHooks: string[];
}): RelevantAssistantHook[] => {
  return getRelevantAssistantHooks({
    availableHooks,
    selectedHooks,
  });
};

type BuildAssistantWorkspaceModelArgs = {
  assistant: AssistantListItem;
  availableSkills: SkillInfo[];
  availableHooks: HookInfo[];
  pendingSkills: PendingSkill[];
  selectedSkills: string[];
  selectedHooks: string[];
};

const hasAgentsEntryDocument = (packageManifest?: AgentPackageManifest): boolean =>
  packageManifest?.entryDocument.file === 'AGENTS.md';

const resolvePackageAssistantId = (assistant: AssistantListItem): string => {
  if (typeof assistant.linkedPackagePresetId === 'string' && assistant.linkedPackagePresetId.trim()) {
    return assistant.linkedPackagePresetId.trim();
  }

  return assistant.id;
};

export const buildAssistantWorkspaceModel = ({
  assistant,
  availableSkills,
  availableHooks,
  pendingSkills,
  selectedSkills,
  selectedHooks,
}: BuildAssistantWorkspaceModelArgs): AssistantWorkspaceModel => {
  const packageAssistantId = resolvePackageAssistantId(assistant);
  const packageDescriptor = findBundledAgentPackageDescriptorByAssistantId(packageAssistantId);
  const packageManifest = packageDescriptor?.manifest;
  const agentsDocument: AssistantPackageDocument | null = null;
  const docs: AssistantPackageDocument[] = [];
  const docsTree: AssistantPackageDocTreeNode[] = [];
  const commands = buildCommandItems(packageAssistantId);
  const schedules = buildScheduleItems(packageAssistantId);
  const relevantSkills = buildRelevantSkills({
    assistantId: packageAssistantId,
    availableSkills,
    pendingSkills,
    selectedSkills,
  });
  const relevantHooks = buildRelevantHooks({
    availableHooks,
    selectedHooks,
  });
  const isEditable = !assistant.isBuiltin && !isExtensionAssistant(assistant);
  const availableTabs = new Set<AgentDetailTabId>();

  if (isEditable || relevantSkills.length > 0 || Boolean(getBundledAgentPackagePayload(packageAssistantId, 'skills'))) {
    availableTabs.add('skills');
  }

  if (isEditable || relevantHooks.length > 0 || Boolean(getBundledAgentPackagePayload(packageAssistantId, 'hooks'))) {
    availableTabs.add('hooks');
  }

  if (isEditable || schedules.length > 0) {
    availableTabs.add('schedules');
  }

  if (isEditable || commands.length > 0) {
    availableTabs.add('commands');
  }

  if (agentsDocument || hasAgentsEntryDocument(packageManifest)) {
    availableTabs.add('agents');
  }

  if (docs.length > 0 || Boolean(packageManifest?.docsDirectory)) {
    availableTabs.add('docs');
  }

  if (availableTabs.size === 0) {
    availableTabs.add('skills');
  }

  const orderedTabs = AGENT_DETAIL_TAB_PRIORITY.filter((tabId) => availableTabs.has(tabId));
  const defaultTab =
    AGENT_DETAIL_TAB_PRIORITY.find((tabId) => {
      if (!availableTabs.has(tabId)) {
        return false;
      }

      switch (tabId) {
        case 'skills':
          return (
            relevantSkills.length > 0 ||
            isEditable ||
            Boolean(getBundledAgentPackagePayload(packageAssistantId, 'skills'))
          );
        case 'hooks':
          return (
            relevantHooks.length > 0 ||
            isEditable ||
            Boolean(getBundledAgentPackagePayload(packageAssistantId, 'hooks'))
          );
        case 'schedules':
          return schedules.length > 0 || isEditable;
        case 'commands':
          return commands.length > 0 || isEditable;
        case 'agents':
          return Boolean(agentsDocument || hasAgentsEntryDocument(packageManifest));
        case 'docs':
          return docs.length > 0 || Boolean(packageManifest?.docsDirectory);
        default:
          return false;
      }
    }) ||
    orderedTabs[0] ||
    null;

  return {
    assistant,
    packageAssistantId,
    packageDescriptor,
    packageManifest,
    agentsDocument,
    docs,
    docsTree,
    commands,
    schedules,
    relevantSkills,
    relevantHooks,
    availableTabs: orderedTabs,
    defaultTab,
    isEditable,
  };
};

export const getVisibleAgentWorkspaceTabs = (model: AssistantWorkspaceModel): AgentDetailTabId[] => {
  const availableTabs = new Set(
    model.availableTabs.filter((tabId) => {
      switch (tabId) {
        case 'agents':
          return Boolean(model.agentsDocument || hasAgentsEntryDocument(model.packageManifest));
        case 'docs':
          return model.docs.length > 0 || Boolean(model.packageManifest?.docsDirectory);
        default:
          return true;
      }
    })
  );

  return AGENT_DETAIL_TAB_PRIORITY.filter((tabId) => availableTabs.has(tabId));
};
