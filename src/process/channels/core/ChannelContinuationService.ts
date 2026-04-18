/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { uuid } from '@/common/utils';
import { conversationServiceSingleton } from '@/process/services/conversationServiceSingleton';
import type { ContextGoUIDatabase } from '@process/services/database';
import { getDatabase } from '@process/services/database';
import type { IAgentManager } from '@process/task/IAgentManager';
import { workerTaskManager } from '@process/task/workerTaskManagerSingleton';
import crypto from 'crypto';
import { inferRemoteChatType } from './ChannelRouteResolver';
import { buildConversationPublicationProfile } from './ChannelPublicationService';
import { ProjectChannelPublicationService } from './ProjectChannelPublicationService';
import {
  type IChannelControlLease,
  resolveChannelConvType,
  withChannelBindingTarget,
  type ChannelControlMode,
  type ChannelContinuationMode,
  type IAgentProfile,
  type IChannelBinding,
  type IChannelContinuationRequest,
  type IChannelContinuationReleaseResult,
  type IChannelContinuationResult,
  type IChannelSession,
  type IExternalSession,
  type IRemoteIdentity,
} from '../types';

type ContinuationTaskManager = Pick<typeof workerTaskManager, 'getTask'>;
type ContinuationDependencies = {
  getDatabase: typeof getDatabase;
  taskManager: ContinuationTaskManager;
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

const DEFAULT_CONTINUATION_MODE: ChannelContinuationMode = 'resume';
const DEFAULT_CONFLICT_POLICY: NonNullable<IChannelContinuationRequest['conflictPolicy']> = 'reject';
const DEFAULT_CONTINUATION_PRIORITY = 120;
const DEFAULT_CONTROL_MODE: ChannelControlMode = 'im_owner';
const projectChannelPublicationService = new ProjectChannelPublicationService();

async function getConversationPublicationCatalog() {
  const conversations = await conversationServiceSingleton.listAllConversations();
  return projectChannelPublicationService.readCatalogForConversations(conversations);
}

function assertQuerySuccess<T>(result: QueryResult<T>, fallback: string): T {
  if (!result.success) {
    throw new Error(result.error || fallback);
  }
  return result.data as T;
}

function buildStableBindingId(channelAccountId: string, chatId: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${channelAccountId}|${chatId}|continuation`)
    .digest('hex')
    .slice(0, 16);
  return `binding_continuation_${hash}`;
}

function buildDesktopOwnerKey(conversationId: string): string {
  return `desktop:${conversationId}`;
}

function buildImOwnerKey(channelAccountId: string, chatId: string): string {
  return `im:${channelAccountId}:${chatId}`;
}

function toChannelAgentType(backend: string): IChannelSession['agentType'] {
  const { convType } = resolveChannelConvType(backend);
  return convType as IChannelSession['agentType'];
}

export class ChannelContinuationService {
  constructor(private readonly deps: ContinuationDependencies = { getDatabase, taskManager: workerTaskManager }) {}

  async continueSession(params: IChannelContinuationRequest): Promise<IChannelContinuationResult> {
    const mode = params.mode ?? DEFAULT_CONTINUATION_MODE;
    const conflictPolicy = params.conflictPolicy ?? DEFAULT_CONFLICT_POLICY;
    const controlMode = params.controlMode ?? DEFAULT_CONTROL_MODE;
    const db = await this.deps.getDatabase();

    const connector = assertQuerySuccess(
      db.getChannelAccount(params.targetChannelAccountId),
      `Failed to load channel account ${params.targetChannelAccountId}`
    );
    if (!connector) {
      throw new Error(`Channel account ${params.targetChannelAccountId} not found`);
    }

    const exactTargetIdentity = assertQuerySuccess(
      db.getRemoteIdentityByChannelAccountChat(params.targetChannelAccountId, params.targetChatId),
      'Failed to load target remote identity'
    );
    const targetIdentity =
      exactTargetIdentity ??
      (params.targetPlatformChatId
        ? assertQuerySuccess(
            db.getRemoteIdentityByChannelAccountPlatformChat(params.targetChannelAccountId, params.targetPlatformChatId),
            'Failed to load target remote identity'
          )
        : null);
    if (!targetIdentity) {
      throw new Error('Target chat is not paired yet');
    }

    const source = await this.resolveSourceContext(db, params);
    await this.enforceConflictPolicy(source.sourceConversationId, conflictPolicy);

    const now = Date.now();
    const transaction = db.runInTransaction(() => {
      const sourceAgentProfile = this.ensureSourceAgentProfile(db, source);

      const targetAudienceKey = targetIdentity.remoteChatId;
      const transportChatId = params.targetPlatformChatId ?? targetIdentity.platformChatId ?? targetAudienceKey;
      const resolvedChatType = inferRemoteChatType({
        chatId: transportChatId,
        platformUserId: params.targetPlatformUserId ?? targetIdentity.remoteUserId ?? transportChatId,
        remoteChatType: params.targetChatType ?? targetIdentity.remoteChatType,
      });

      const updatedIdentity: IRemoteIdentity = {
        ...targetIdentity,
        remoteUserId:
          resolvedChatType === 'group'
            ? (targetIdentity.remoteUserId ?? params.targetPlatformUserId)
            : (params.targetPlatformUserId ?? targetIdentity.remoteUserId),
        platformChatId: transportChatId,
        remoteChatType: resolvedChatType ?? targetIdentity.remoteChatType,
        displayName: params.targetDisplayName ?? targetIdentity.displayName,
        lastActive: now,
      };
      assertQuerySuccess(db.upsertRemoteIdentity(updatedIdentity), 'Failed to update target identity');

      const continuationBindingBase: IChannelBinding = {
        id: buildStableBindingId(params.targetChannelAccountId, targetAudienceKey),
        channelAccountId: params.targetChannelAccountId,
        scopeType: 'remote_chat',
        scopeKey: targetAudienceKey,
        agentProfileId: sourceAgentProfile.id,
        priority: params.priority ?? DEFAULT_CONTINUATION_PRIORITY,
        enabled: true,
        temporary: params.temporary ?? false,
        createdAt: now,
        updatedAt: now,
      };

      const continuationBinding = withChannelBindingTarget(
        continuationBindingBase,
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
          continuation: {
            sourceConversationId: source.sourceConversationId,
            sourceExternalSessionId: source.sourceExternalSession?.id,
            resumeConversationId: source.sourceConversationId,
            mode,
            conflictPolicy,
            switchedAt: now,
          },
        }
      );
      assertQuerySuccess(db.upsertChannelBinding(continuationBinding), 'Failed to upsert continuation binding');

      const existingTargetSession = assertQuerySuccess(
        db.getExternalSessionByChannelAccountRemote(params.targetChannelAccountId, updatedIdentity.id),
        'Failed to load target external session'
      );

      const nextTargetSession: IExternalSession = existingTargetSession
        ? {
            ...existingTargetSession,
            bindingId: continuationBinding.id,
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
                ownerKey:
                  controlMode === 'im_owner'
                    ? buildImOwnerKey(params.targetChannelAccountId, targetAudienceKey)
                    : buildDesktopOwnerKey(
                        source.sourceConversationId || existingTargetSession.activeConversationId || 'unknown'
                      ),
                controlMode,
                sourceExternalSessionId: source.sourceExternalSession?.id,
                sourceConversationId: source.sourceConversationId,
                mode,
                updatedAt: now,
              },
            },
          }
        : {
            id: `external_session_${uuid()}`,
            channelAccountId: params.targetChannelAccountId,
            remoteIdentityId: updatedIdentity.id,
            bindingId: continuationBinding.id,
            agentProfileId: sourceAgentProfile.id,
            activeConversationId: mode === 'resume' ? source.sourceConversationId : undefined,
            state: 'active',
            createdAt: now,
            lastActivity: now,
            metadata: {
              source: 'channel-continuation',
              control: {
                ownerKey:
                  controlMode === 'im_owner'
                    ? buildImOwnerKey(params.targetChannelAccountId, targetAudienceKey)
                    : buildDesktopOwnerKey(source.sourceConversationId || 'unknown'),
                controlMode,
                sourceExternalSessionId: source.sourceExternalSession?.id,
                sourceConversationId: source.sourceConversationId,
                mode,
                updatedAt: now,
              },
            },
          };
      assertQuerySuccess(db.upsertExternalSession(nextTargetSession), 'Failed to upsert target external session');
      assertQuerySuccess(
        db.upsertChannelControlLease({
          externalSessionId: nextTargetSession.id,
          ownerKey:
            controlMode === 'im_owner'
              ? buildImOwnerKey(params.targetChannelAccountId, targetAudienceKey)
              : buildDesktopOwnerKey(source.sourceConversationId || 'unknown'),
          controlMode,
          sourceExternalSessionId: source.sourceExternalSession?.id,
          sourceConversationId: source.sourceConversationId,
          continuationMode: mode,
          createdAt: existingTargetSession ? now : now,
          updatedAt: now,
        } satisfies IChannelControlLease),
        'Failed to upsert channel control lease'
      );

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
            continuation: {
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
        bindingId: continuationBinding.id,
        targetExternalSessionId: nextTargetSession.id,
        sourceExternalSessionId: source.sourceExternalSession?.id,
        conversationId: nextTargetSession.activeConversationId,
        agentProfileId: sourceAgentProfile.id,
        mode,
      } satisfies IChannelContinuationResult;
    });

    if (!transaction.success || !transaction.data) {
      throw new Error(transaction.error || 'Channel continuation transaction failed');
    }

    return transaction.data;
  }

  async releaseContinuation(targetExternalSessionId: string): Promise<IChannelContinuationReleaseResult> {
    const db = await this.deps.getDatabase();
    const targetExternalSession = assertQuerySuccess(
      db.getExternalSession(targetExternalSessionId),
      `Failed to load target external session ${targetExternalSessionId}`
    );
    if (!targetExternalSession) {
      throw new Error(`Target external session ${targetExternalSessionId} not found`);
    }

    const binding = targetExternalSession.bindingId
      ? assertQuerySuccess(db.getChannelBinding(targetExternalSession.bindingId), 'Failed to load continuation binding')
      : null;

    const bindingMetadata =
      binding?.metadata && typeof binding.metadata === 'object' ? (binding.metadata as Record<string, unknown>) : {};
    const bindingContinuation =
      bindingMetadata.continuation && typeof bindingMetadata.continuation === 'object'
        ? (bindingMetadata.continuation as Record<string, unknown>)
        : {};
    const targetMetadata =
      targetExternalSession.metadata && typeof targetExternalSession.metadata === 'object'
        ? (targetExternalSession.metadata as Record<string, unknown>)
        : {};
    const controlMetadata =
      targetMetadata.control && typeof targetMetadata.control === 'object'
        ? (targetMetadata.control as Record<string, unknown>)
        : {};

    const sourceExternalSessionId =
      typeof controlMetadata.sourceExternalSessionId === 'string' && controlMetadata.sourceExternalSessionId
        ? controlMetadata.sourceExternalSessionId
        : typeof bindingContinuation.sourceExternalSessionId === 'string' && bindingContinuation.sourceExternalSessionId
          ? bindingContinuation.sourceExternalSessionId
          : undefined;

    const sourceConversationId =
      typeof controlMetadata.sourceConversationId === 'string' && controlMetadata.sourceConversationId
        ? controlMetadata.sourceConversationId
        : typeof bindingContinuation.sourceConversationId === 'string' && bindingContinuation.sourceConversationId
          ? bindingContinuation.sourceConversationId
          : typeof bindingContinuation.resumeConversationId === 'string' && bindingContinuation.resumeConversationId
            ? bindingContinuation.resumeConversationId
            : undefined;

    const now = Date.now();
    const transaction = db.runInTransaction(() => {
      if (binding?.temporary) {
        assertQuerySuccess(db.deleteChannelBinding(binding.id), `Failed to delete continuation binding ${binding.id}`);
      }

      const releasedTargetSession: IExternalSession = {
        ...targetExternalSession,
        bindingId: binding?.temporary ? undefined : targetExternalSession.bindingId,
        activeConversationId: undefined,
        lastActivity: now,
        metadata: {
          ...targetMetadata,
          control: {
            ...controlMetadata,
            controlMode: 'desktop_owner',
            releasedAt: now,
          },
        },
      };
      assertQuerySuccess(db.upsertExternalSession(releasedTargetSession), 'Failed to release target external session');
      assertQuerySuccess(
        db.upsertChannelControlLease({
          externalSessionId: releasedTargetSession.id,
          ownerKey: buildDesktopOwnerKey(
            sourceConversationId || releasedTargetSession.activeConversationId || 'unknown'
          ),
          controlMode: 'desktop_owner',
          sourceExternalSessionId,
          sourceConversationId,
          continuationMode:
            bindingContinuation.mode === 'new_thread' || bindingContinuation.mode === 'resume'
              ? bindingContinuation.mode
              : undefined,
          createdAt: now,
          updatedAt: now,
          releasedAt: now,
        } satisfies IChannelControlLease),
        'Failed to update released control lease'
      );

      let restoredSourceExternalSessionId: string | undefined;
      let restoredConversationId: string | undefined;
      if (sourceExternalSessionId && sourceConversationId) {
        const sourceExternalSession = assertQuerySuccess(
          db.getExternalSession(sourceExternalSessionId),
          `Failed to load source external session ${sourceExternalSessionId}`
        );
        if (sourceExternalSession) {
          const restoredSourceSession: IExternalSession = {
            ...sourceExternalSession,
            activeConversationId: sourceConversationId,
            lastActivity: now,
            metadata: {
              ...sourceExternalSession.metadata,
              control: {
                ownerKey: buildDesktopOwnerKey(sourceConversationId),
                controlMode: 'desktop_owner',
                restoredAt: now,
              },
              continuation: {
                transferredConversationId: undefined,
                targetExternalSessionId: undefined,
                restoredAt: now,
              },
            },
          };
          assertQuerySuccess(
            db.upsertExternalSession(restoredSourceSession),
            'Failed to restore source external session'
          );
          assertQuerySuccess(
            db.upsertChannelControlLease({
              externalSessionId: restoredSourceSession.id,
              ownerKey: buildDesktopOwnerKey(sourceConversationId),
              controlMode: 'desktop_owner',
              createdAt: now,
              updatedAt: now,
              releasedAt: now,
            } satisfies IChannelControlLease),
            'Failed to restore source control lease'
          );
          restoredSourceExternalSessionId = restoredSourceSession.id;
          restoredConversationId = sourceConversationId;
        }
      }

      const mirroredSessions = assertQuerySuccess(db.getChannelSessions(), 'Failed to load channel session mirrors');
      const targetMirror = mirroredSessions.find((session) => session.id === releasedTargetSession.id);
      if (targetMirror) {
        assertQuerySuccess(
          db.deleteChannelSession(targetMirror.id),
          'Failed to delete target continuation session mirror'
        );
      }

      if (restoredSourceExternalSessionId) {
        const sourceMirror = mirroredSessions.find((session) => session.id === restoredSourceExternalSessionId);
        if (sourceMirror && restoredConversationId) {
          assertQuerySuccess(
            db.upsertChannelSession({
              ...sourceMirror,
              conversationId: restoredConversationId,
              lastActivity: now,
            }),
            'Failed to refresh source channel session mirror'
          );
        }
      }

      return {
        targetExternalSessionId,
        releasedBindingId: binding?.id,
        restoredSourceExternalSessionId,
        restoredConversationId,
      } satisfies IChannelContinuationReleaseResult;
    });

    if (!transaction.success || !transaction.data) {
      throw new Error(transaction.error || 'Channel continuation release transaction failed');
    }

    return transaction.data;
  }

  async updateContinuationControlMode(
    targetExternalSessionId: string,
    controlMode: ChannelControlMode
  ): Promise<IChannelContinuationReleaseResult> {
    const db = await this.deps.getDatabase();
    const targetExternalSession = assertQuerySuccess(
      db.getExternalSession(targetExternalSessionId),
      `Failed to load target external session ${targetExternalSessionId}`
    );
    if (!targetExternalSession) {
      throw new Error(`Target external session ${targetExternalSessionId} not found`);
    }

    const targetMetadata =
      targetExternalSession.metadata && typeof targetExternalSession.metadata === 'object'
        ? (targetExternalSession.metadata as Record<string, unknown>)
        : {};
    const controlMetadata =
      targetMetadata.control && typeof targetMetadata.control === 'object'
        ? (targetMetadata.control as Record<string, unknown>)
        : {};
    const targetRemoteIdentity = assertQuerySuccess(
      db.getRemoteIdentity(targetExternalSession.remoteIdentityId),
      `Failed to load target remote identity ${targetExternalSession.remoteIdentityId}`
    );
    const sourceConversationId =
      typeof controlMetadata.sourceConversationId === 'string' && controlMetadata.sourceConversationId
        ? controlMetadata.sourceConversationId
        : targetExternalSession.activeConversationId;

    const updated: IExternalSession = {
      ...targetExternalSession,
      lastActivity: Date.now(),
      metadata: {
        ...targetMetadata,
        control: {
          ...controlMetadata,
          ownerKey:
            controlMode === 'im_owner'
              ? buildImOwnerKey(targetExternalSession.channelAccountId, targetRemoteIdentity?.remoteChatId || 'unknown')
              : buildDesktopOwnerKey(sourceConversationId || 'unknown'),
          controlMode,
          updatedAt: Date.now(),
        },
      },
    };
    assertQuerySuccess(db.upsertExternalSession(updated), 'Failed to update continuation control mode');
    assertQuerySuccess(
      db.upsertChannelControlLease({
        externalSessionId: updated.id,
        ownerKey:
          controlMode === 'im_owner'
            ? buildImOwnerKey(targetExternalSession.channelAccountId, targetRemoteIdentity?.remoteChatId || 'unknown')
            : buildDesktopOwnerKey(sourceConversationId || 'unknown'),
        controlMode,
        sourceExternalSessionId:
          typeof controlMetadata.sourceExternalSessionId === 'string'
            ? controlMetadata.sourceExternalSessionId
            : undefined,
        sourceConversationId,
        continuationMode:
          controlMetadata.mode === 'resume' || controlMetadata.mode === 'new_thread' ? controlMetadata.mode : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        releasedAt: controlMode === 'desktop_owner' ? Date.now() : undefined,
      } satisfies IChannelControlLease),
      'Failed to update channel control lease'
    );
    return {
      targetExternalSessionId: updated.id,
      restoredConversationId: sourceConversationId,
    };
  }

  private async resolveSourceContext(
    db: ContextGoUIDatabase,
    params: IChannelContinuationRequest
  ): Promise<SourceContext> {
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
      throw new Error('No source conversation available for resume continuation');
    }

    if (sourceExternalSession) {
      const publicationCatalog = await getConversationPublicationCatalog();
      const sourceAgentProfile = publicationCatalog.agentProfiles.find(
        (profile) => profile.id === sourceExternalSession.agentProfileId
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
      sourceAgentProfile: await buildConversationPublicationProfile(projectChannelPublicationService, conversation),
    };
  }

  private ensureSourceAgentProfile(_db: ContextGoUIDatabase, source: SourceContext): IAgentProfile {
    return source.sourceAgentProfile;
  }

  private async enforceConflictPolicy(
    sourceConversationId: string | undefined,
    policy: NonNullable<IChannelContinuationRequest['conflictPolicy']>
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

let continuationService: ChannelContinuationService | null = null;

export function getChannelContinuationService(): ChannelContinuationService {
  if (!continuationService) {
    continuationService = new ChannelContinuationService();
  }
  return continuationService;
}
