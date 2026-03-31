/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import type { TMessage } from '@/common/chat/chatLib';

export type OpenClawGatewayStatus = 'connecting' | 'connected' | 'session_active' | 'disconnected' | 'error';
export const OPENCLAW_FINISH_SETTLE_MS = 180;
type OpenClawRuntimeStatus = {
  isConnected?: boolean | null;
  hasActiveSession?: boolean | null;
  sessionKey?: string | null;
};

type OpenClawMessageLike = Pick<IResponseMessage, 'type' | 'data'>;

const OPENCLAW_CONNECTION_ERROR_PREFIXES = ['Gateway disconnected:', 'Connection error:'];

export const isOpenClawLifecycleStatusMessage = (message: OpenClawMessageLike): boolean => {
  return message.type === 'agent_status';
};

export const isOpenClawConnectionErrorMessage = (message: OpenClawMessageLike): boolean => {
  if (message.type !== 'error' || typeof message.data !== 'string') {
    return false;
  }

  const normalized = message.data.trim();
  return OPENCLAW_CONNECTION_ERROR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

export const shouldSuppressOpenClawStreamMessage = (message: OpenClawMessageLike): boolean => {
  return isOpenClawLifecycleStatusMessage(message) || isOpenClawConnectionErrorMessage(message);
};

export const isOpenClawActivityMessageType = (message: Pick<IResponseMessage, 'type'>): boolean => {
  return message.type === 'thought' || message.type === 'content' || message.type === 'acp_permission';
};

export const shouldSuppressOpenClawPersistedMessage = (message: TMessage): boolean => {
  if (message.type === 'agent_status') {
    return true;
  }

  if (message.type !== 'tips' || message.content?.type !== 'error' || typeof message.content?.content !== 'string') {
    return false;
  }

  const normalized = message.content.content.trim();
  return OPENCLAW_CONNECTION_ERROR_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

export const resolveOpenClawRuntimeStatus = (runtime?: OpenClawRuntimeStatus | null): OpenClawGatewayStatus | null => {
  if (!runtime) {
    return null;
  }

  if (runtime.isConnected && runtime.hasActiveSession) {
    return 'session_active';
  }

  if (runtime.isConnected) {
    return 'connected';
  }

  if (runtime.hasActiveSession || runtime.sessionKey) {
    return 'disconnected';
  }

  return null;
};
