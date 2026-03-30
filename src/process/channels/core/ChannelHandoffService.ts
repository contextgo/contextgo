/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import type { AionUIDatabase } from '@process/services/database';
import { getDatabase } from '@process/services/database';
import type { IAgentManager } from '@process/task/IAgentManager';
import { workerTaskManager } from '@process/task/workerTaskManagerSingleton';
import crypto from 'crypto';
import { inferRemoteChatType } from './ChannelRouteResolver';
import {
  resolveChannelConvType,
  withChannelBindingTarget,
  type ChannelHandoffMode,
  type IAgentProfile,
  type IChannelBinding,
  type IChannelHandoffRequest,
  type IChannelHandoffResult,
  type IChannelSession,
  type IExternalSession,
  type IRemoteIdentity,
} from '../types';

type HandoffTaskManager = Pick<typeof workerTaskManager, 'getTask'>;
type HandoffDependencies = {
  getDatabase: typeof getDatabase;
  taskManager: HandoffTaskManager;
};

type SourceContext = {
  sourceExternalSession?: IExternalSession;
  sourceConversationId?: string;
  sourceAgentProfile: IAgentProfile;
};

type QueryResult<T> = {
  success: boolean;
  error?: string;
  data?: T;
};

const DEFAULT_HANDOFF_MODE: ChannelHandoffMode = 'resume';
const DEFAULT_CONFLICT_POLICY: NonNullable<IChannelHandoffRequest['conflictPolicy']> = 'reject';
const DEFAULT_HANDOFF_PRIORITY = 120;

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

  throw new Error(`Unsupported conversation type for channel handoff: ${conversation.type}`);
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

function buildStableBindingId(connectorId: string, chatId: string): string {
  const hash = crypto.createHash('sha256').update(`${connectorId}|${chatId}|handoff`).digest('hex').slice(0, 16);
  return `binding_handoff_${hash}`;
}

function toChannelAgentType(backend: string): IChannelSession['agentType'] {
  const { convType } = resolveChannelConvType(backend);
  return convType as IChannelSession['agentType'];
}

export class ChannelHandoffService {
  constructor(private readonly deps: HandoffDependencies = { getDatabase, taskManager: workerTaskManager }) {}

  async prepareConversationAgentProfile(conversationId: string): Promise<IAgentProfile> {
    const db = await this.deps.getDatabase();
    const conversation = assertQuerySuccess(
      db.getConversation(conversationId),
      `Failed to load source conversation ${conversationId}`
    );
    const sourceAgentProfile = this.buildAgentProfileFromConversation(db, conversation);
    return this.ensureSourceAgentProfile(db, {
      sourceConversationId: conversationId,
      sourceAgentProfile,
    });
  }

  async handoffSession(params: IChannelHandoffRequest): Promise<IChannelHandoffResult> {
    const mode = params.mode ?? DEFAULT_HANDOFF_MODE;
    const conflictPolicy = params.conflictPolicy ?? DEFAULT_CONFLICT_POLICY;
    const db = await this.deps.getDatabase();

    const connector = assertQuerySuccess(
      db.getConnectorInstance(params.targetConnectorId),
      `Failed to load connector ${params.targetConnectorId}`
    );
    if (!connector) {
      throw new Error(`Connector ${params.targetConnectorId} not found`);
    }

    const targetIdentity = assertQuerySuccess(
      db.getRemoteIdentityByConnectorChat(params.targetConnectorId, params.targetChatId),
      'Failed to load target remote identity'
    );
    if (!targetIdentity) {
      throw new Error('Target chat is not paired yet');
    }

    const source = this.resolveSourceContext(db, params);
    await this.enforceConflictPolicy(source.sourceConversationId, conflictPolicy);

    const now = Date.now();
    const transaction = db.runInTransaction(() => {
      const sourceAgentProfile = this.ensureSourceAgentProfile(db, source);

      const resolvedChatType = inferRemoteChatType({
        chatId: targetIdentity.remoteChatId,
        platformUserId: params.targetPlatformUserId ?? targetIdentity.remoteUserId ?? targetIdentity.remoteChatId,
        remoteChatType: params.targetChatType ?? targetIdentity.remoteChatType,
      });

      const updatedIdentity: IRemoteIdentity = {
        ...targetIdentity,
        remoteUserId:
          resolvedChatType === 'group'
            ? (targetIdentity.remoteUserId ?? params.targetPlatformUserId)
            : (params.targetPlatformUserId ?? targetIdentity.remoteUserId),
        remoteChatType: resolvedChatType ?? targetIdentity.remoteChatType,
        displayName: params.targetDisplayName ?? targetIdentity.displayName,
        lastActive: now,
      };
      assertQuerySuccess(db.upsertRemoteIdentity(updatedIdentity), 'Failed to update target identity');

      const handoffBindingBase: IChannelBinding = {
        id: buildStableBindingId(params.targetConnectorId, params.targetChatId),
        connectorId: params.targetConnectorId,
        scopeType: 'remote_chat',
        scopeKey: params.targetChatId,
        agentProfileId: sourceAgentProfile.id,
        priority: params.priority ?? DEFAULT_HANDOFF_PRIORITY,
        enabled: true,
        temporary: params.temporary ?? false,
        createdAt: now,
        updatedAt: now,
      };

      const handoffBinding = withChannelBindingTarget(
        handoffBindingBase,
        source.sourceExternalSession
          ? {
              type: 'external_session',
              id: source.sourceExternalSession.id,
              mode,
            }
          : {
              type: 'agent_profile',
              id: sourceAgentProfile.id,
            },
        {
          handoff: {
            sourceConversationId: source.sourceConversationId,
            sourceExternalSessionId: source.sourceExternalSession?.id,
            resumeConversationId: source.sourceConversationId,
            mode,
            conflictPolicy,
            switchedAt: now,
          },
        }
      );
      assertQuerySuccess(db.upsertChannelBinding(handoffBinding), 'Failed to upsert handoff binding');

      const existingTargetSession = assertQuerySuccess(
        db.getExternalSessionByConnectorRemote(params.targetConnectorId, updatedIdentity.id),
        'Failed to load target external session'
      );

      const nextTargetSession: IExternalSession = existingTargetSession
        ? {
            ...existingTargetSession,
            bindingId: handoffBinding.id,
            agentProfileId: sourceAgentProfile.id,
            activeConversationId:
              mode === 'resume' && source.sourceConversationId
                ? source.sourceConversationId
                : mode === 'new_thread'
                  ? undefined
                  : existingTargetSession.activeConversationId,
            lastActivity: now,
            metadata: {
              ...existingTargetSession.metadata,
              control: {
                ownerKey: `${params.targetConnectorId}:${params.targetChatId}`,
                sourceExternalSessionId: source.sourceExternalSession?.id,
                sourceConversationId: source.sourceConversationId,
                mode,
                updatedAt: now,
              },
            },
          }
        : {
            id: `external_session_${uuid()}`,
            connectorId: params.targetConnectorId,
            remoteIdentityId: updatedIdentity.id,
            bindingId: handoffBinding.id,
            agentProfileId: sourceAgentProfile.id,
            activeConversationId: mode === 'resume' ? source.sourceConversationId : undefined,
            state: 'active',
            createdAt: now,
            lastActivity: now,
            metadata: {
              source: 'channel-handoff',
              control: {
                ownerKey: `${params.targetConnectorId}:${params.targetChatId}`,
                sourceExternalSessionId: source.sourceExternalSession?.id,
                sourceConversationId: source.sourceConversationId,
                mode,
                updatedAt: now,
              },
            },
          };
      assertQuerySuccess(db.upsertExternalSession(nextTargetSession), 'Failed to upsert target external session');

      if (
        mode === 'resume' &&
        source.sourceExternalSession &&
        source.sourceConversationId &&
        source.sourceExternalSession.id !== nextTargetSession.id
      ) {
        const releasedSourceSession: IExternalSession = {
          ...source.sourceExternalSession,
          activeConversationId: undefined,
          lastActivity: now,
          metadata: {
            ...source.sourceExternalSession.metadata,
            handoff: {
              transferredConversationId: source.sourceConversationId,
              targetExternalSessionId: nextTargetSession.id,
              updatedAt: now,
            },
          },
        };
        assertQuerySuccess(db.upsertExternalSession(releasedSourceSession), 'Failed to detach source external session');
      }

      const mirroredSession: IChannelSession = {
        id: nextTargetSession.id,
        userId: updatedIdentity.id,
        agentType: toChannelAgentType(sourceAgentProfile.backend),
        conversationId: nextTargetSession.activeConversationId,
        workspace: sourceAgentProfile.workspaceRef,
        chatId: updatedIdentity.remoteChatId,
        createdAt: nextTargetSession.createdAt,
        lastActivity: now,
      };
      assertQuerySuccess(db.upsertChannelSession(mirroredSession), 'Failed to upsert channel session mirror');

      return {
        bindingId: handoffBinding.id,
        targetExternalSessionId: nextTargetSession.id,
        sourceExternalSessionId: source.sourceExternalSession?.id,
        conversationId: nextTargetSession.activeConversationId,
        agentProfileId: sourceAgentProfile.id,
        mode,
      } satisfies IChannelHandoffResult;
    });

    if (!transaction.success || !transaction.data) {
      throw new Error(transaction.error || 'Channel handoff transaction failed');
    }

    return transaction.data;
  }

  private resolveSourceContext(db: AionUIDatabase, params: IChannelHandoffRequest): SourceContext {
    if (!params.sourceExternalSessionId && !params.sourceConversationId) {
      throw new Error('sourceExternalSessionId or sourceConversationId is required');
    }

    let sourceExternalSession: IExternalSession | undefined;
    if (params.sourceExternalSessionId) {
      sourceExternalSession =
        assertQuerySuccess(
          db.getExternalSession(params.sourceExternalSessionId),
          'Failed to load source external session'
        ) ?? undefined;
      if (!sourceExternalSession) {
        throw new Error(`Source external session ${params.sourceExternalSessionId} not found`);
      }
    } else if (params.sourceConversationId) {
      sourceExternalSession =
        assertQuerySuccess(
          db.getExternalSessionByActiveConversation(params.sourceConversationId),
          'Failed to query source external session by conversation'
        ) ?? undefined;
    }

    const sourceConversationId = sourceExternalSession?.activeConversationId ?? params.sourceConversationId;
    if (params.mode !== 'new_thread' && !sourceConversationId) {
      throw new Error('No source conversation available for resume handoff');
    }

    if (sourceExternalSession) {
      const sourceAgentProfile = assertQuerySuccess(
        db.getAgentProfile(sourceExternalSession.agentProfileId),
        'Failed to load source agent profile'
      );
      if (!sourceAgentProfile) {
        throw new Error(`Source agent profile ${sourceExternalSession.agentProfileId} not found`);
      }
      return {
        sourceExternalSession,
        sourceConversationId,
        sourceAgentProfile,
      };
    }

    if (!sourceConversationId) {
      throw new Error('sourceConversationId is required when source external session is missing');
    }

    const conversation = assertQuerySuccess(
      db.getConversation(sourceConversationId),
      `Failed to load source conversation ${sourceConversationId}`
    );
    return {
      sourceConversationId,
      sourceAgentProfile: this.buildAgentProfileFromConversation(db, conversation),
    };
  }

  private ensureSourceAgentProfile(db: AionUIDatabase, source: SourceContext): IAgentProfile {
    const existing = assertQuerySuccess(
      db.getAgentProfile(source.sourceAgentProfile.id),
      'Failed to query agent profile'
    );
    if (existing) {
      return existing;
    }
    assertQuerySuccess(db.upsertAgentProfile(source.sourceAgentProfile), 'Failed to upsert source agent profile');
    return source.sourceAgentProfile;
  }

  private buildAgentProfileFromConversation(db: AionUIDatabase, conversation: TChatConversation): IAgentProfile {
    const backend = mapConversationBackend(conversation);
    const modelRef = extractConversationModelRef(conversation);
    const workspaceRef = extractConversationWorkspace(conversation);

    const profileHash = crypto.createHash('sha256').update(conversation.id).digest('hex').slice(0, 16);
    const profileId = `agent_profile_handoff_${profileHash}`;
    const existing = assertQuerySuccess(db.getAgentProfile(profileId), `Failed to query handoff profile ${profileId}`);
    const now = Date.now();
    const extra = conversation.extra as Record<string, unknown> | undefined;

    return {
      id: profileId,
      name: conversation.name,
      backend,
      modelRef,
      workspaceRef,
      promptProfile: {
        sourceConversationId: conversation.id,
        customAgentId: typeof extra?.customAgentId === 'string' ? extra.customAgentId : undefined,
        agentName: typeof extra?.agentName === 'string' ? extra.agentName : undefined,
      },
      toolPolicy: {},
      memoryPolicy: {},
      delegationPolicy: {},
      publishedFromConversationId: conversation.id,
      version: existing?.version ?? 1,
      archived: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  private async enforceConflictPolicy(
    sourceConversationId: string | undefined,
    policy: NonNullable<IChannelHandoffRequest['conflictPolicy']>
  ): Promise<void> {
    if (!sourceConversationId) {
      return;
    }

    const task = this.deps.taskManager.getTask(sourceConversationId);
    if (!task || task.status !== 'running') {
      return;
    }

    if (policy === 'reject') {
      throw new Error('Source conversation has a running task');
    }

    await this.stopTask(task);
  }

  private async stopTask(task: IAgentManager): Promise<void> {
    try {
      await task.stop();
    } catch (error) {
      throw new Error(
        `Failed to interrupt running source task: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      );
    }
  }
}

let handoffService: ChannelHandoffService | null = null;

export function getChannelHandoffService(): ChannelHandoffService {
  if (!handoffService) {
    handoffService = new ChannelHandoffService();
  }
  return handoffService;
}
