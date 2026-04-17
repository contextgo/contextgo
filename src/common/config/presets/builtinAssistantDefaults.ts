/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendConfig } from '@/common/types/acpTypes';
import { ASSISTANT_PRESETS } from './assistantPresets';
import {
  getBundledAgentPackageDefaultEnabledHookNames,
  getBundledAgentPackageDefaultEnabledSkillNames,
  getBundledAgentPackageOwnedSkillNames,
  getBundledAgentPackageWorkspaceSkillBootstrapStrategy,
} from './bundledAgentPackageRegistry';
import { CONTEXT_ENGINE_SYSTEM_ASSISTANTS } from './systemAssistants';

export const BUILTIN_ASSISTANT_PREFIX = 'builtin-';

export const DEFAULT_ENABLED_BUILTIN_PRESET_IDS = new Set([
  'morph-ppt',
  'design-director',
  'figma-closed-loop',
  'marketing-creative-studio',
  'motion-studio',
  'startup-strategist',
  'office-analyst',
  'finance-analyst',
  'pm-workbench',
  'superpowers',
  'everything-in-claude-code',
  'karpathy-coding-guard',
]);

export const findBuiltinAssistantPreset = (assistantId: string) => {
  if (!assistantId.startsWith(BUILTIN_ASSISTANT_PREFIX)) {
    return undefined;
  }

  const presetId = assistantId.slice(BUILTIN_ASSISTANT_PREFIX.length);
  return ASSISTANT_PRESETS.find((preset) => preset.id === presetId);
};

export const resolveBuiltinAssistantEnabledSkills = (
  assistantId: string,
  enabledSkills: string[] | undefined
): string[] | undefined => {
  if (enabledSkills !== undefined) {
    return enabledSkills;
  }

  return getBundledAgentPackageDefaultEnabledSkillNames(assistantId);
};

export const resolveBuiltinAssistantEnabledHooks = (
  assistantId: string,
  enabledHooks: string[] | undefined
): string[] | undefined => {
  if (enabledHooks !== undefined) {
    return enabledHooks;
  }

  return getBundledAgentPackageDefaultEnabledHookNames(assistantId);
};

export const resolveBuiltinAssistantWorkspaceSkillNames = (
  assistantId: string,
  enabledSkills: string[] | undefined
): string[] | undefined => {
  if (enabledSkills !== undefined) {
    return enabledSkills;
  }

  const preset = findBuiltinAssistantPreset(assistantId);
  if (!preset) {
    return enabledSkills;
  }

  const bootstrapStrategy = getBundledAgentPackageWorkspaceSkillBootstrapStrategy(assistantId);

  if (bootstrapStrategy === 'packaged-skills') {
    return getBundledAgentPackageOwnedSkillNames(assistantId);
  }

  return getBundledAgentPackageDefaultEnabledSkillNames(assistantId);
};

export const buildBuiltinAssistants = (): AcpBackendConfig[] => {
  return ASSISTANT_PRESETS.map((preset) => {
    const nameI18n = preset.nameI18n ?? { 'en-US': preset.id };
    const descriptionI18n = preset.descriptionI18n ?? { 'en-US': '' };
    const enabledByDefault = DEFAULT_ENABLED_BUILTIN_PRESET_IDS.has(preset.id);

    return {
      id: `${BUILTIN_ASSISTANT_PREFIX}${preset.id}`,
      name: nameI18n['en-US'] ?? preset.id,
      nameI18n,
      description: descriptionI18n['en-US'] ?? '',
      descriptionI18n,
      avatar: preset.avatar,
      enabled: enabledByDefault,
      isPreset: true,
      isBuiltin: true,
      builtinTier: 'product',
      builtinVisibility: enabledByDefault ? 'featured' : 'settings',
      presetAgentType: preset.presetAgentType || 'gemini',
      enabledSkills: getBundledAgentPackageDefaultEnabledSkillNames(`${BUILTIN_ASSISTANT_PREFIX}${preset.id}`),
      enabledHooks: getBundledAgentPackageDefaultEnabledHookNames(`${BUILTIN_ASSISTANT_PREFIX}${preset.id}`),
      harnessTagI18n: preset.harnessTagI18n,
      recommendedDomainI18n: preset.recommendedDomainI18n,
      workspaceBootstrapHintI18n: preset.workspaceBootstrapHintI18n,
      promptsI18n: preset.promptsI18n,
    };
  });
};

export const buildContextEngineSystemAssistants = (): AcpBackendConfig[] => {
  return CONTEXT_ENGINE_SYSTEM_ASSISTANTS.map((assistant) => ({
    id: assistant.id,
    name: assistant.nameI18n['en-US'] ?? assistant.id,
    nameI18n: assistant.nameI18n,
    description: assistant.descriptionI18n['en-US'] ?? '',
    descriptionI18n: assistant.descriptionI18n,
    enabled: true,
    isPreset: false,
    isBuiltin: true,
    builtinTier: 'system',
    builtinVisibility: 'featured',
    systemOwner: assistant.owner,
    systemRole: assistant.systemRole,
    executionBoundary: assistant.runtimeSpec.executionBoundary,
    triggerKinds: [...assistant.runtimeSpec.triggerKinds],
    promptProfile: { ...assistant.runtimeSpec.promptProfile },
    toolPolicy: { ...assistant.runtimeSpec.toolPolicy },
    memoryPolicy: { ...assistant.runtimeSpec.memoryPolicy },
    delegationPolicy: { ...assistant.runtimeSpec.delegationPolicy },
  }));
};
