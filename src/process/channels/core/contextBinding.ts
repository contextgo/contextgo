/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConversationSpaceBinding, TChatConversation } from '@/common/config/storage';
import type { IAgentProfile, IExternalSession } from '../types';

export type ChannelContextBinding = {
  spaceId?: ConversationSpaceBinding['spaceId'];
  mountId?: ConversationSpaceBinding['mountId'];
  workspaceRef?: string;
};

const normalizeString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

export const extractConversationContextBinding = (
  conversation: TChatConversation | undefined
): ChannelContextBinding => {
  const extra = conversation?.extra as
    | (ConversationSpaceBinding & {
        workspace?: string;
      })
    | undefined;

  return {
    spaceId: normalizeString(extra?.spaceId),
    mountId: normalizeString(extra?.mountId),
    workspaceRef: normalizeString(extra?.workingDirectory) ?? normalizeString(extra?.workspace),
  };
};

export const extractAgentProfileContextBinding = (profile: IAgentProfile | undefined): ChannelContextBinding => ({
  spaceId: normalizeString(profile?.spaceId),
  mountId: normalizeString(profile?.mountId),
  workspaceRef: normalizeString(profile?.workspaceRef),
});

export const extractExternalSessionContextBinding = (session: IExternalSession | undefined): ChannelContextBinding => ({
  spaceId: normalizeString(session?.spaceId),
  mountId: normalizeString(session?.mountId),
  workspaceRef: normalizeString(session?.workspaceRef),
});

export const mergeChannelContextBindings = (
  ...bindings: Array<ChannelContextBinding | undefined>
): ChannelContextBinding => {
  const merged: ChannelContextBinding = {};

  bindings.forEach((binding) => {
    if (!binding) {
      return;
    }

    if (!merged.spaceId && binding.spaceId) {
      merged.spaceId = binding.spaceId;
    }
    if (!merged.mountId && binding.mountId) {
      merged.mountId = binding.mountId;
    }
    if (!merged.workspaceRef && binding.workspaceRef) {
      merged.workspaceRef = binding.workspaceRef;
    }
  });

  return merged;
};

export const conversationMatchesChannelContextBinding = (
  conversation: TChatConversation,
  binding: ChannelContextBinding
): boolean => {
  const conversationBinding = extractConversationContextBinding(conversation);

  if (binding.spaceId && conversationBinding.spaceId !== binding.spaceId) {
    return false;
  }

  if (binding.mountId && conversationBinding.mountId !== binding.mountId) {
    return false;
  }

  if (binding.workspaceRef && conversationBinding.workspaceRef !== binding.workspaceRef) {
    return false;
  }

  return true;
};
