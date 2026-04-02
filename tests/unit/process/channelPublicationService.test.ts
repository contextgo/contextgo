/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChannelPublicationService } from '../../../src/process/channels/core/ChannelPublicationService';

function buildPublicationProfileId(conversationId: string): string {
  const profileHash = createHash('sha256').update(conversationId).digest('hex').slice(0, 16);
  return `agent_profile_publication_${profileHash}`;
}

describe('ChannelPublicationService', () => {
  const conversation = {
    id: 'conversation-1',
    name: 'Prepared Agent',
    type: 'openclaw-gateway',
    extra: {
      workspace: '/workspace/project',
      customAgentId: 'assistant-custom',
      agentName: 'Prepared Agent',
    },
    model: {
      id: 'model-provider-1',
      useModel: 'gpt-4.1',
    },
  };

  const canonicalProfileId = buildPublicationProfileId(conversation.id);
  const existingProfile = {
    id: canonicalProfileId,
    name: 'Prepared Agent',
    backend: 'openclaw-gateway',
    modelRef: {
      id: 'model-provider-1',
      useModel: 'gpt-4.1',
    },
    workspaceRef: '/workspace/project',
    promptProfile: {},
    toolPolicy: { allowTools: true },
    memoryPolicy: { remember: true },
    delegationPolicy: { enabled: true },
    publishedFromConversationId: conversation.id,
    version: 3,
    archived: false,
    createdAt: 100,
    updatedAt: 200,
  };

  const db = {
    getConversation: vi.fn(),
    getAgentProfileByPublishedConversation: vi.fn(),
    getAgentProfile: vi.fn(),
    upsertAgentProfile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    db.getConversation.mockReturnValue({ success: true, data: conversation });
    db.getAgentProfileByPublishedConversation.mockReturnValue({ success: true, data: null });
    db.getAgentProfile.mockReturnValue({ success: true, data: null });
    db.upsertAgentProfile.mockReturnValue({ success: true, data: true });
  });

  it('creates the canonical publication profile id when no publication profile exists', async () => {
    const service = new ChannelPublicationService({ getDatabase: vi.fn(async () => db as never) });
    const result = await service.prepareConversationPublication(conversation.id);

    expect(db.upsertAgentProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: canonicalProfileId,
        publishedFromConversationId: conversation.id,
        toolPolicy: {},
        memoryPolicy: {},
        delegationPolicy: {},
      })
    );
    expect(result.id).toBe(canonicalProfileId);
  });

  it('reuses the existing publication profile state when preparing the canonical publication profile', async () => {
    db.getAgentProfileByPublishedConversation.mockReturnValueOnce({ success: true, data: existingProfile });

    const service = new ChannelPublicationService({ getDatabase: vi.fn(async () => db as never) });
    const result = await service.prepareConversationPublication(conversation.id);

    expect(db.upsertAgentProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: canonicalProfileId,
        publishedFromConversationId: conversation.id,
        toolPolicy: existingProfile.toolPolicy,
        memoryPolicy: existingProfile.memoryPolicy,
        delegationPolicy: existingProfile.delegationPolicy,
        createdAt: existingProfile.createdAt,
      })
    );
    expect(result.id).toBe(canonicalProfileId);
  });
});
