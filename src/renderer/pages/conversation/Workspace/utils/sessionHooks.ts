/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getConversationRuntimeBackend, type TChatConversation } from '@/common/config/storage';

type ConversationLike = Pick<TChatConversation, 'type' | 'extra'>;

export const getConversationEnabledHooks = (conversation: ConversationLike): string[] => {
  const extra = conversation.extra as { enabledHooks?: unknown } | undefined;
  const enabledHooks = extra?.enabledHooks;
  if (!Array.isArray(enabledHooks)) return [];

  return enabledHooks
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
};

export const resolveConversationHookBackend = (conversation: ConversationLike): string => {
  return getConversationRuntimeBackend(conversation as TChatConversation);
};
