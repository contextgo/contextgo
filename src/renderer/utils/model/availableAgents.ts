/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AcpBackendConfig } from '@/common/types/acpTypes';
import type { AvailableAgent } from './agentTypes';

export const AVAILABLE_AGENTS_SWR_KEY = 'acp.agents.available';

export const PRODUCT_VISIBLE_RUNTIME_BACKENDS = ['codex', 'claude', 'gemini', 'opencode'] as const;

export const PRODUCT_VISIBLE_PRESET_AGENT_TYPES = ['codex', 'claude', 'gemini', 'opencode'] as const;

const PRODUCT_VISIBLE_RUNTIME_BACKEND_SET = new Set<string>(PRODUCT_VISIBLE_RUNTIME_BACKENDS);
const PRODUCT_VISIBLE_RUNTIME_BACKEND_PRIORITY = new Map<string, number>(
  PRODUCT_VISIBLE_RUNTIME_BACKENDS.map((backend, index) => [backend, index])
);

export function isProductVisibleRuntimeBackend(backend: string): boolean {
  return PRODUCT_VISIBLE_RUNTIME_BACKEND_SET.has(backend);
}

export function sortAvailableAgentsForUi(availableAgents: AvailableAgent[]): AvailableAgent[] {
  return availableAgents
    .map((agent, index) => ({
      agent,
      index,
      priority:
        agent.isPreset === true ? Number.POSITIVE_INFINITY : PRODUCT_VISIBLE_RUNTIME_BACKEND_PRIORITY.get(agent.backend),
    }))
    .toSorted((left, right) => {
      const leftPriority = left.priority ?? Number.POSITIVE_INFINITY;
      const rightPriority = right.priority ?? Number.POSITIVE_INFINITY;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.index - right.index;
    })
    .map(({ agent }) => agent);
}

export function filterAvailableAgentsForUi(availableAgents: AvailableAgent[]): AvailableAgent[] {
  return sortAvailableAgentsForUi(
    availableAgents.filter((agent) => {
      if (agent.backend === 'custom') {
        return true;
      }

      return isProductVisibleRuntimeBackend(agent.backend);
    })
  );
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
