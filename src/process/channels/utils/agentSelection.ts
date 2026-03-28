/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';

const TELEGRAM_AGENT_CALLBACK_PREFIX = 'agent:';
const MAX_TELEGRAM_CALLBACK_DATA_LENGTH = 64;
const MAX_AGENT_CALLBACK_TOKEN_LENGTH = MAX_TELEGRAM_CALLBACK_DATA_LENGTH - TELEGRAM_AGENT_CALLBACK_PREFIX.length;
const AGENT_CALLBACK_HASH_LENGTH = 24;

export type ChannelSelectableAgent = {
  key: string;
  backend: string;
  emoji: string;
  name: string;
  customAgentId?: string;
};

type AgentSelectionInfo = Pick<ChannelSelectableAgent, 'key' | 'backend'>;

/**
 * Build a Telegram-safe callback token for an agent selection button.
 * Long dynamic agent keys must be shortened to stay within Telegram's
 * 64-byte callback_data limit.
 */
export function buildAgentSelectionCallbackToken(agent: AgentSelectionInfo): string {
  if (agent.key.length <= MAX_AGENT_CALLBACK_TOKEN_LENGTH) {
    return agent.key;
  }

  const digest = createHash('sha256').update(agent.key).digest('hex').slice(0, AGENT_CALLBACK_HASH_LENGTH);
  const maxBackendLength = Math.max(1, MAX_AGENT_CALLBACK_TOKEN_LENGTH - digest.length - 1);
  const backendPrefix = agent.backend.slice(0, maxBackendLength);
  return `${backendPrefix}:${digest}`;
}

export function matchesAgentSelectionCallbackToken(agent: AgentSelectionInfo, candidate: string): boolean {
  return agent.key === candidate || buildAgentSelectionCallbackToken(agent) === candidate;
}
