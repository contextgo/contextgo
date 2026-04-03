/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendConfig } from '@/common/types/acpTypes';
import type { AvailableAgent } from './agentTypes';

export const AVAILABLE_AGENTS_SWR_KEY = 'acp.agents.available';

export const PRODUCT_VISIBLE_RUNTIME_BACKENDS = [
  'gemini',
  'claude',
  'codex',
  'opencode',
  'openclaw-gateway',
  'nanobot',
] as const;

export const PRODUCT_VISIBLE_PRESET_AGENT_TYPES = ['gemini', 'claude', 'codex', 'opencode'] as const;

const PRODUCT_VISIBLE_RUNTIME_BACKEND_SET = new Set<string>(PRODUCT_VISIBLE_RUNTIME_BACKENDS);

export function isProductVisibleRuntimeBackend(backend: string): boolean {
  return PRODUCT_VISIBLE_RUNTIME_BACKEND_SET.has(backend);
}

export function filterAvailableAgentsForUi(availableAgents: AvailableAgent[]): AvailableAgent[] {
  return availableAgents.filter((agent) => {
    if (agent.backend === 'custom') {
      return true;
    }

    return isProductVisibleRuntimeBackend(agent.backend);
  });
}

export function splitConversationDropdownAgents(availableAgents: AvailableAgent[]): {
  cliAgents: AvailableAgent[];
  presetAssistants: AvailableAgent[];
} {
  return {
    cliAgents: availableAgents.filter((agent) => agent.isPreset !== true),
    presetAssistants: availableAgents.filter((agent) => agent.isPreset === true),
  };
}

export function buildConversationPresetAssistants(
  assistants: AcpBackendConfig[],
  localeKey?: string
): AvailableAgent[] {
  return assistants
    .filter((assistant) => {
      if (assistant.isPreset !== true || assistant.enabled === false) {
        return false;
      }

      const presetAgentType = assistant.presetAgentType || 'gemini';
      return PRODUCT_VISIBLE_PRESET_AGENT_TYPES.includes(
        presetAgentType as (typeof PRODUCT_VISIBLE_PRESET_AGENT_TYPES)[number]
      );
    })
    .map((assistant) => ({
      backend: 'custom',
      name: assistant.nameI18n?.[localeKey || ''] || assistant.name,
      customAgentId: assistant.id,
      isPreset: true,
      avatar: assistant.avatar,
      presetAgentType: assistant.presetAgentType,
    }));
}
