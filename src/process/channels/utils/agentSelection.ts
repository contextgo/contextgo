/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ChannelSelectableAgent = {
  key: string;
  backend: string;
  emoji: string;
  name: string;
  customAgentId?: string;
};

function encodeAgentKey(key: string): string {
  return Buffer.from(key, 'utf8').toString('base64url');
}

function decodeAgentKey(token: string): string | null {
  try {
    return Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

export function buildAgentSelectionCallbackToken(agent: Pick<ChannelSelectableAgent, 'key'>): string {
  return encodeAgentKey(agent.key);
}

export function matchesAgentSelectionCallbackToken(agent: Pick<ChannelSelectableAgent, 'key'>, token: string): boolean {
  if (!token) return false;
  if (token === agent.key) return true;
  if (buildAgentSelectionCallbackToken(agent) === token) return true;
  return decodeAgentKey(token) === agent.key;
}
