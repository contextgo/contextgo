/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { conversationServiceSingleton } from '@process/services/conversationServiceSingleton';
import crypto from 'crypto';
import type { IAgentProfile } from '../types';
import { ProjectChannelPublicationService } from './ProjectChannelPublicationService';

type PublicationDependencies = {
  getConversation: typeof conversationServiceSingleton.getConversation;
  publicationStore: Pick<
    ProjectChannelPublicationService,
    'resolveConversationWorkspace' | 'getAgentProfileByPublishedConversation' | 'getAgentProfile' | 'upsertAgentProfile'
  >;
};

function mapConversationBackend(conversation: TChatConversation): string {
  if (conversation.type === 'gemini' || conversation.type === 'codex') {
    return conversation.type;
  }

  if (conversation.type === 'acp') {
    const extra = conversation.extra as { backend?: string };
    return extra.backend && extra.backend.trim() ? extra.backend : 'claude';
  }

  throw new Error(`Unsupported conversation type for channel publication: ${conversation.type}`);
}

function extractConversationWorkspace(conversation: TChatConversation): string | undefined {
  const extra = conversation.extra as Record<string, unknown> | undefined;
  return typeof extra?.workspace === 'string' && extra.workspace ? extra.workspace : undefined;
}

function extractConversationSpaceId(conversation: TChatConversation): string | undefined {
  const extra = conversation.extra as Record<string, unknown> | undefined;
  return typeof extra?.spaceId === 'string' && extra.spaceId ? extra.spaceId : undefined;
}

function extractConversationModelRef(conversation: TChatConversation): IAgentProfile['modelRef'] {
  const conversationModel = (
    conversation as unknown as {
      model?: {
        id?: unknown;
        useModel?: unknown;
        platform?: unknown;
        name?: unknown;
        baseUrl?: unknown;
      };
    }
  ).model;
  if (
    conversationModel &&
    typeof conversationModel === 'object' &&
    typeof conversationModel.id === 'string' &&
    conversationModel.id &&
    typeof conversationModel.useModel === 'string' &&
    conversationModel.useModel
  ) {
    return {
      id: conversationModel.id,
      useModel: conversationModel.useModel,
      ...(typeof conversationModel.platform === 'string' && conversationModel.platform
        ? { platform: conversationModel.platform }
        : {}),
      ...(typeof conversationModel.name === 'string' && conversationModel.name ? { name: conversationModel.name } : {}),
      ...(typeof conversationModel.baseUrl === 'string' ? { baseUrl: conversationModel.baseUrl } : {}),
    };
  }
  return undefined;
}

export function buildPublicationProfileId(conversationId: string): string {
  const profileHash = crypto.createHash('sha256').update(conversationId).digest('hex').slice(0, 16);
  return `agent_profile_publication_${profileHash}`;
}

async function resolveExistingPublicationProfile(
  publicationStore: Pick<
    ProjectChannelPublicationService,
    'getAgentProfileByPublishedConversation' | 'getAgentProfile'
  >,
  workspace: string,
  conversationId: string
): Promise<IAgentProfile | null> {
  const byPublishedConversation = await publicationStore.getAgentProfileByPublishedConversation(
    workspace,
    conversationId
  );
  if (byPublishedConversation) {
    return byPublishedConversation;
  }

  return publicationStore.getAgentProfile(workspace, buildPublicationProfileId(conversationId));
}

export async function buildConversationPublicationProfile(
  publicationStore: Pick<
    ProjectChannelPublicationService,
    'resolveConversationWorkspace' | 'getAgentProfileByPublishedConversation' | 'getAgentProfile'
  >,
  conversation: TChatConversation
): Promise<IAgentProfile> {
  const workspace = publicationStore.resolveConversationWorkspace(conversation);
  if (!workspace) {
    throw new Error('Conversation workspace is required before publishing an Agent to IM channels');
  }

  const existing = await resolveExistingPublicationProfile(publicationStore, workspace, conversation.id);
  const backend = mapConversationBackend(conversation);
  const modelRef = extractConversationModelRef(conversation);
  const workspaceRef = extractConversationWorkspace(conversation) ?? workspace;
  const spaceId = extractConversationSpaceId(conversation);
  const now = Date.now();
  const extra = conversation.extra as Record<string, unknown> | undefined;

  return {
    id: buildPublicationProfileId(conversation.id),
    name: conversation.name,
    backend,
    modelRef,
    workspaceRef,
    spaceId,
    promptProfile: {
      sourceConversationId: conversation.id,
      customAgentId: typeof extra?.customAgentId === 'string' ? extra.customAgentId : undefined,
      agentName: typeof extra?.agentName === 'string' ? extra.agentName : undefined,
    },
    toolPolicy: existing?.toolPolicy ?? {},
    memoryPolicy: existing?.memoryPolicy ?? {},
    delegationPolicy: existing?.delegationPolicy ?? {},
    publishedFromConversationId: conversation.id,
    version: existing?.version ?? 1,
    archived: false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export class ChannelPublicationService {
  constructor(
    private readonly deps: PublicationDependencies = {
      getConversation: conversationServiceSingleton.getConversation.bind(conversationServiceSingleton),
      publicationStore: new ProjectChannelPublicationService(),
    }
  ) {}

  async prepareConversationPublication(conversationId: string): Promise<IAgentProfile> {
    const conversation = await this.deps.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Failed to load source conversation ${conversationId}`);
    }

    const profile = await buildConversationPublicationProfile(this.deps.publicationStore, conversation);
    const workspace = this.deps.publicationStore.resolveConversationWorkspace(conversation);
    if (!workspace) {
      throw new Error('Conversation workspace is required before publishing an Agent to IM channels');
    }

    return this.deps.publicationStore.upsertAgentProfile(workspace, profile);
  }

  async prepareConversationAgentProfile(conversationId: string): Promise<IAgentProfile> {
    return this.prepareConversationPublication(conversationId);
  }
}

let publicationService: ChannelPublicationService | null = null;

export function getChannelPublicationService(): ChannelPublicationService {
  if (!publicationService) {
    publicationService = new ChannelPublicationService();
  }
  return publicationService;
}
