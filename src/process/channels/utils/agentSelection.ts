/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

export type AgentSelectionCallbackPayload = {
  key: string;
  backend: string;
};

const MAX_CALLBACK_TOKEN_LENGTH = 56;
const CALLBACK_TOKEN_PREFIX = 'agt_';
const CALLBACK_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CALLBACK_TOKENS = 2048;

type StoredCallbackPayload = AgentSelectionCallbackPayload & {
  createdAt: number;
};

const callbackTokens = new Map<string, StoredCallbackPayload>();

function cleanupCallbackTokens(): void {
  const now = Date.now();

  for (const [token, payload] of callbackTokens.entries()) {
    if (now - payload.createdAt > CALLBACK_TOKEN_TTL_MS) {
      callbackTokens.delete(token);
    }
  }

  while (callbackTokens.size > MAX_CALLBACK_TOKENS) {
    const oldestToken = callbackTokens.keys().next().value;
    if (!oldestToken) {
      break;
    }
    callbackTokens.delete(oldestToken);
  }
}

export function buildAgentSelectionCallbackToken(payload: AgentSelectionCallbackPayload): string {
  if (payload.key.length <= MAX_CALLBACK_TOKEN_LENGTH) {
    return payload.key;
  }

  cleanupCallbackTokens();

  const token = `${CALLBACK_TOKEN_PREFIX}${crypto.randomBytes(6).toString('hex')}`;
  callbackTokens.set(token, {
    ...payload,
    createdAt: Date.now(),
  });
  return token;
}

export function resolveAgentSelectionCallbackToken(token: string): AgentSelectionCallbackPayload | null {
  const payload = callbackTokens.get(token);
  if (!payload) {
    return null;
  }

  if (Date.now() - payload.createdAt > CALLBACK_TOKEN_TTL_MS) {
    callbackTokens.delete(token);
    return null;
  }

  return {
    key: payload.key,
    backend: payload.backend,
  };
}
