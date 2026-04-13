/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import {
  findBuiltinAssistantPreset,
  resolveBuiltinAssistantEnabledHooks,
  resolveBuiltinAssistantEnabledSkills,
} from '@/common/config/presets/builtinAssistantDefaults';
import { getBundledAgentPackageRulesFiles } from '@/common/config/presets/bundledAgentPackageRegistry';
import { ConfigStorage } from '@/common/config/storage';

export type PresetAssistantResourceDeps = {
  readAssistantRule: (args: { assistantId: string; locale: string }) => Promise<string>;
  readAssistantSkill: (args: { assistantId: string; locale: string }) => Promise<string>;
  readBuiltinRule: (args: { fileName: string }) => Promise<string>;
  getEnabledSkills: (customAgentId: string) => Promise<string[] | undefined>;
  getEnabledHooks: (customAgentId: string) => Promise<string[] | undefined>;
  warn: (message: string, error?: unknown) => void;
};

export type LoadPresetAssistantResourcesOptions = {
  customAgentId?: string;
  localeKey: string;
  fallbackRules?: string;
};

export type PresetAssistantResources = {
  rules?: string;
  skills: string;
  enabledSkills?: string[];
  enabledHooks?: string[];
};

const defaultDeps: PresetAssistantResourceDeps = {
  readAssistantRule: (args) => ipcBridge.fs.readAssistantRule.invoke(args),
  readAssistantSkill: (args) => ipcBridge.fs.readAssistantSkill.invoke(args),
  readBuiltinRule: (args) => ipcBridge.fs.readBuiltinRule.invoke(args),
  getEnabledSkills: async (customAgentId) => {
    const customAgents = ((await ConfigStorage.get('acp.customAgents')) || []) as Array<{
      id: string;
      enabledSkills?: string[];
      enabledHooks?: string[];
    }>;
    const assistant = customAgents?.find((agent) => agent.id === customAgentId);
    return assistant?.enabledSkills;
  },
  getEnabledHooks: async (customAgentId) => {
    const customAgents = ((await ConfigStorage.get('acp.customAgents')) || []) as Array<{
      id: string;
      enabledSkills?: string[];
      enabledHooks?: string[];
    }>;
    const assistant = customAgents?.find((agent) => agent.id === customAgentId);
    return assistant?.enabledHooks;
  },
  warn: (message, error) => {
    console.warn(message, error);
  },
};

export async function loadPresetAssistantResources(
  options: LoadPresetAssistantResourcesOptions,
  deps: PresetAssistantResourceDeps = defaultDeps
): Promise<PresetAssistantResources> {
  const { customAgentId, localeKey, fallbackRules } = options;

  if (!customAgentId) {
    return {
      rules: fallbackRules,
      skills: '',
      enabledSkills: undefined,
      enabledHooks: undefined,
    };
  }

  let rules = '';
  let skills = '';

  try {
    rules = (await deps.readAssistantRule({ assistantId: customAgentId, locale: localeKey })) || '';
  } catch (error) {
    deps.warn(`[presetAssistantResources] Failed to load rules for ${customAgentId}`, error);
  }

  try {
    skills = (await deps.readAssistantSkill({ assistantId: customAgentId, locale: localeKey })) || '';
  } catch (error) {
    deps.warn(`[presetAssistantResources] Failed to load skills for ${customAgentId}`, error);
  }

  const preset = findBuiltinAssistantPreset(customAgentId);

  if (preset) {
    if (!rules) {
      try {
        const ruleFiles = getBundledAgentPackageRulesFiles(customAgentId);
        const ruleFile = ruleFiles?.[localeKey] || ruleFiles?.['en-US'];
        if (ruleFile) {
          rules = (await deps.readBuiltinRule({ fileName: ruleFile })) || '';
        }
      } catch (error) {
        deps.warn(`[presetAssistantResources] Failed to load builtin rules for ${customAgentId}`, error);
      }
    }
  }

  const enabledSkills = resolveBuiltinAssistantEnabledSkills(customAgentId, await deps.getEnabledSkills(customAgentId));
  const enabledHooks = resolveBuiltinAssistantEnabledHooks(customAgentId, await deps.getEnabledHooks(customAgentId));

  return {
    rules: rules || fallbackRules,
    skills,
    enabledSkills,
    enabledHooks,
  };
}
