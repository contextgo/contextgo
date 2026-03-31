/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendConfig } from '@/common/types/acpTypes';
import { ASSISTANT_PRESETS } from './assistantPresets';

const BUILTIN_ASSISTANT_PREFIX = 'builtin-';

const DEFAULT_ENABLED_BUILTIN_PRESET_IDS = new Set([
  'pptx-generator',
  'cowork',
  'engineering-workbench',
  'engineering-planner',
  'engineering-reviewer',
  'openclaw-setup',
  'star-office-helper',
  'story-roleplay',
  'moltbook',
  'beautiful-mermaid',
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

  return findBuiltinAssistantPreset(assistantId)?.defaultEnabledSkills;
};

export const resolveBuiltinAssistantEnabledHooks = (
  assistantId: string,
  enabledHooks: string[] | undefined
): string[] | undefined => {
  if (enabledHooks !== undefined) {
    return enabledHooks;
  }

  return findBuiltinAssistantPreset(assistantId)?.defaultEnabledHooks;
};

export const buildBuiltinAssistants = (): AcpBackendConfig[] => {
  return ASSISTANT_PRESETS.map((preset) => ({
    id: `${BUILTIN_ASSISTANT_PREFIX}${preset.id}`,
    name: preset.nameI18n['en-US'],
    nameI18n: preset.nameI18n,
    description: preset.descriptionI18n['en-US'],
    descriptionI18n: preset.descriptionI18n,
    avatar: preset.avatar,
    enabled: DEFAULT_ENABLED_BUILTIN_PRESET_IDS.has(preset.id),
    isPreset: true,
    isBuiltin: true,
    presetAgentType: preset.presetAgentType || 'gemini',
    enabledSkills: preset.defaultEnabledSkills,
    enabledHooks: preset.defaultEnabledHooks,
    promptsI18n: preset.promptsI18n,
  }));
};
