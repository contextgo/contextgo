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
    type: 'acp',
    extra: {
      spaceId: 'space-temp-1',
      workspace: '/workspace/project',
      backend: 'codex',
      customAgentId: 'assistant-custom',
      agentName: 'Prepared Agent',
    },
    model: {
      id: 'model-provider-1',
      useModel: 'gpt-4.1',
      platform: 'gemini-with-google-auth',
      name: 'Gemini',
      baseUrl: '',
    },
  };

  const canonicalProfileId = buildPublicationProfileId(conversation.id);
  const existingProfile = {
    id: canonicalProfileId,
    name: 'Prepared Agent',
    backend: 'codex',
    modelRef: {
      id: 'model-provider-1',
      useModel: 'gpt-4.1',
      platform: 'gemini-with-google-auth',
      name: 'Gemini',
      baseUrl: '',
    },
    workspaceRef: '/workspace/project',
    promptProfile: {},
    toolPolicy: { allowTools: true },
    memoryPolicy: { remember: true },
    delegationPolicy: { enabled: true },
    spaceId: 'space-temp-1',
    publishedFromConversationId: conversation.id,
    version: 3,
    archived: false,
    createdAt: 100,
    updatedAt: 200,
  };

  const publicationStore = {
    resolveConversationWorkspace: vi.fn(),
    getAgentProfileByPublishedConversation: vi.fn(),
    getAgentProfile: vi.fn(),
    upsertAgentProfile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    publicationStore.resolveConversationWorkspace.mockReturnValue('/workspace/project');
    publicationStore.getAgentProfileByPublishedConversation.mockResolvedValue(null);
    publicationStore.getAgentProfile.mockResolvedValue(null);
    publicationStore.upsertAgentProfile.mockImplementation(async (_workspace: string, profile: unknown) => profile);
  });

  it('creates the canonical publication profile id in project local config when no profile exists yet', async () => {
    const service = new ChannelPublicationService({
      getConversation: vi.fn(async () => conversation as never),
      publicationStore: publicationStore as never,
    });
    const result = await service.prepareConversationPublication(conversation.id);

    expect(publicationStore.upsertAgentProfile).toHaveBeenCalledWith(
      '/workspace/project',
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

  it('reuses the existing project-local publication profile state when preparing the canonical profile', async () => {
    publicationStore.getAgentProfileByPublishedConversation.mockResolvedValueOnce(existingProfile);

    const service = new ChannelPublicationService({
      getConversation: vi.fn(async () => conversation as never),
      publicationStore: publicationStore as never,
    });
    const result = await service.prepareConversationPublication(conversation.id);

    expect(publicationStore.upsertAgentProfile).toHaveBeenCalledWith(
      '/workspace/project',
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

  it('preserves provider metadata in the project-local publication model ref for later channel restores', async () => {
    const service = new ChannelPublicationService({
      getConversation: vi.fn(async () => conversation as never),
      publicationStore: publicationStore as never,
    });

    const result = await service.prepareConversationPublication(conversation.id);

    expect(result.modelRef).toEqual({
      id: 'model-provider-1',
      useModel: 'gpt-4.1',
      platform: 'gemini-with-google-auth',
      name: 'Gemini',
      baseUrl: '',
    });
  });

  it('persists the source conversation space binding in the publication profile', async () => {
    const service = new ChannelPublicationService({
      getConversation: vi.fn(async () => conversation as never),
      publicationStore: publicationStore as never,
    });

    const result = await service.prepareConversationPublication(conversation.id);

    expect(publicationStore.upsertAgentProfile).toHaveBeenCalledWith(
      '/workspace/project',
      expect.objectContaining({
        id: canonicalProfileId,
        spaceId: 'space-temp-1',
      })
    );
    expect(result.spaceId).toBe('space-temp-1');
  });
});
