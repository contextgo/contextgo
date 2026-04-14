/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigStorage } from '@/common/config/storage';
import type { AcpBackend } from '../types';

export const getBackendFromAgentKey = (agentKey: string): AcpBackend | 'custom' => {
  if (agentKey.startsWith('custom:')) {
    return 'custom';
  }

  const separatorIndex = agentKey.indexOf(':');
  return (separatorIndex >= 0 ? agentKey.slice(0, separatorIndex) : agentKey) as AcpBackend;
};

/** Save preferred mode to the agent's own config key */
export async function savePreferredMode(agentKey: string, mode: string): Promise<void> {
  try {
    const configKey = getBackendFromAgentKey(agentKey);

    if (configKey === 'gemini') {
      const config = await ConfigStorage.get('gemini.config');
      await ConfigStorage.set('gemini.config', { ...config, preferredMode: mode });
    } else if (configKey !== 'custom') {
      const config = await ConfigStorage.get('acp.config');
      const backendConfig = config?.[configKey as AcpBackend] || {};
      await ConfigStorage.set('acp.config', { ...config, [configKey]: { ...backendConfig, preferredMode: mode } });
    }
  } catch {
    /* silent */
  }
}

/** Save preferred model ID to the agent's acp.config key */
export async function savePreferredModelId(agentKey: string, modelId: string): Promise<void> {
  try {
    const configKey = getBackendFromAgentKey(agentKey);
    if (configKey === 'custom') {
      return;
    }

    const config = await ConfigStorage.get('acp.config');
    const backendConfig = config?.[configKey as AcpBackend] || {};
    await ConfigStorage.set('acp.config', { ...config, [configKey]: { ...backendConfig, preferredModelId: modelId } });
  } catch {
    /* silent */
  }
}

/**
 * Get agent key for selection.
 * Returns "custom:uuid" for custom agents, backend type for others.
 */
export const getAgentKey = (agent: {
  backend: AcpBackend;
  customAgentId?: string;
}): string => {
  if (agent.backend === 'custom' && agent.customAgentId) {
    return `custom:${agent.customAgentId}`;
  }

  return agent.backend;
};
