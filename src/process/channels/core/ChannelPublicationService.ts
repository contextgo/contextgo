/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import type { ContextGoUIDatabase } from '@process/services/database';
import { getDatabase } from '@process/services/database';
import crypto from 'crypto';
import type { IAgentProfile } from '../types';

type PublicationDependencies = {
  getDatabase: typeof getDatabase;
};

type QueryResult<T> = {
  success: boolean;
  error?: string;
  data?: T;
};

function assertQuerySuccess<T>(result: QueryResult<T>, fallback: string): T {
  if (!result.success) {
    throw new Error(result.error || fallback);
  }
  return result.data as T;
}

function mapConversationBackend(conversation: TChatConversation): string {
  if (conversation.type === 'gemini' || conversation.type === 'codex' || conversation.type === 'openclaw-gateway') {
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

function extractConversationModelRef(conversation: TChatConversation): { id: string; useModel: string } | undefined {
  const conversationModel = (conversation as unknown as { model?: { id?: unknown; useModel?: unknown } }).model;
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
    };
  }
  return undefined;
}

function buildPublicationProfileId(conversationId: string): string {
  const profileHash = crypto.createHash('sha256').update(conversationId).digest('hex').slice(0, 16);
  return `agent_profile_publication_${profileHash}`;
}

function resolveExistingPublicationProfile(db: ContextGoUIDatabase, conversationId: string): IAgentProfile | null {
  const byPublishedConversation = assertQuerySuccess(
    db.getAgentProfileByPublishedConversation(conversationId),
    `Failed to query publication profile for conversation ${conversationId}`
  );
  if (byPublishedConversation) {
    return byPublishedConversation;
  }

  const publicationProfileId = buildPublicationProfileId(conversationId);
  const publicationProfile = assertQuerySuccess(
    db.getAgentProfile(publicationProfileId),
    `Failed to query publication profile ${publicationProfileId}`
  );
  if (publicationProfile) {
    return publicationProfile;
  }

  return null;
}

export function buildConversationPublicationProfile(
  db: ContextGoUIDatabase,
  conversation: TChatConversation,
  existing: IAgentProfile | null = resolveExistingPublicationProfile(db, conversation.id)
): IAgentProfile {
  const backend = mapConversationBackend(conversation);
  const modelRef = extractConversationModelRef(conversation);
  const workspaceRef = extractConversationWorkspace(conversation);
  const now = Date.now();
  const extra = conversation.extra as Record<string, unknown> | undefined;

  return {
    id: buildPublicationProfileId(conversation.id),
    name: conversation.name,
    backend,
    modelRef,
    workspaceRef,
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

export function ensureConversationPublicationProfile(
  db: ContextGoUIDatabase,
  conversation: TChatConversation
): IAgentProfile {
  const profile = buildConversationPublicationProfile(db, conversation);
  assertQuerySuccess(db.upsertAgentProfile(profile), `Failed to upsert publication profile ${profile.id}`);
  return profile;
}

export class ChannelPublicationService {
  constructor(private readonly deps: PublicationDependencies = { getDatabase }) {}

  async prepareConversationPublication(conversationId: string): Promise<IAgentProfile> {
    const db = await this.deps.getDatabase();
    const conversation = assertQuerySuccess(
      db.getConversation(conversationId),
      `Failed to load source conversation ${conversationId}`
    );
    return ensureConversationPublicationProfile(db, conversation);
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
