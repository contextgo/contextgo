/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IConversationService, CreateConversationParams, MigrateConversationParams } from './IConversationService';
import type { IConversationRepository } from '@process/services/database/IConversationRepository';
import type { TChatConversation } from '@/common/config/storage';
import type { DiscussionGroupParticipant } from '@/common/config/storage';
import { SqliteSpaceRepository } from '@process/services/database/space/SqliteSpaceRepository';
import type { ISpaceService } from '@process/services/space/ISpaceService';
import { SpaceServiceImpl } from '@process/services/space/SpaceServiceImpl';
import { uuid } from '@/common/utils';
import { cronService } from './cron/cronServiceSingleton';
import {
  createGeminiAgent,
  createAcpAgent,
  createCodexAgent,
  createOpenClawAgent,
  createNanobotAgent,
  createGroupConversation,
} from '@process/utils/initAgent';

// Keep legacy workspace fields synchronized with the new Space/Mount/workingDirectory model
// so mixed old/new records can still round-trip safely through update flows.
const normalizeConversationExtraCompatibility = <TExtra extends Record<string, unknown>>(extra: TExtra): TExtra => {
  const normalizedExtra = { ...extra } as TExtra & {
    workspace?: string;
    workingDirectory?: string;
    runtimeValidation?: {
      expectedWorkspace?: string;
      expectedWorkingDirectory?: string;
    };
  };

  if (typeof normalizedExtra.workingDirectory === 'string' && !normalizedExtra.workspace) {
    normalizedExtra.workspace = normalizedExtra.workingDirectory;
  } else if (typeof normalizedExtra.workspace === 'string' && !normalizedExtra.workingDirectory) {
    normalizedExtra.workingDirectory = normalizedExtra.workspace;
  }

  if (normalizedExtra.runtimeValidation) {
    const runtimeValidation = { ...normalizedExtra.runtimeValidation };
    if (typeof runtimeValidation.expectedWorkingDirectory === 'string' && !runtimeValidation.expectedWorkspace) {
      runtimeValidation.expectedWorkspace = runtimeValidation.expectedWorkingDirectory;
    } else if (typeof runtimeValidation.expectedWorkspace === 'string' && !runtimeValidation.expectedWorkingDirectory) {
      runtimeValidation.expectedWorkingDirectory = runtimeValidation.expectedWorkspace;
    }
    normalizedExtra.runtimeValidation = runtimeValidation;
  }

  return normalizedExtra;
};

/**
 * Concrete implementation of IConversationService.
 * Delegates persistence to an injected IConversationRepository.
 */
export class ConversationServiceImpl implements IConversationService {
  constructor(
    private readonly repo: IConversationRepository,
    private readonly spaceService: ISpaceService = new SpaceServiceImpl(new SqliteSpaceRepository())
  ) {}

  private async attachDefaultSpaceIfMissing(
    conversation: TChatConversation | undefined
  ): Promise<TChatConversation | undefined> {
    if (!conversation || !conversation.extra || conversation.extra.spaceId) {
      return conversation;
    }

    const defaultSpace = await this.spaceService.ensureDefaultSpace();
    return {
      ...conversation,
      extra: normalizeConversationExtraCompatibility({
        ...conversation.extra,
        spaceId: defaultSpace.id,
      }),
    } as TChatConversation;
  }

  async getConversation(id: string): Promise<TChatConversation | undefined> {
    return this.attachDefaultSpaceIfMissing(await this.repo.getConversation(id));
  }

  async listAllConversations(): Promise<TChatConversation[]> {
    const conversations = await this.repo.listAllConversations();
    const normalizedConversations: TChatConversation[] = [];
    for (const conversation of conversations) {
      const normalizedConversation = await this.attachDefaultSpaceIfMissing(conversation);
      if (normalizedConversation) {
        normalizedConversations.push(normalizedConversation);
      }
    }
    return normalizedConversations;
  }

  async deleteConversation(id: string): Promise<void> {
    try {
      const jobs = await cronService.listJobsByConversation(id);
      for (const job of jobs) {
        await cronService.removeJob(job.id);
      }
    } catch (err) {
      console.warn('[ConversationServiceImpl] Failed to cleanup cron jobs:', err);
    }
    await this.repo.deleteConversation(id);
  }

  async updateConversation(id: string, updates: Partial<TChatConversation>, mergeExtra?: boolean): Promise<void> {
    let finalUpdates = updates;
    if (mergeExtra && updates.extra) {
      const existing = await this.repo.getConversation(id);
      if (existing) {
        finalUpdates = {
          ...updates,
          extra: normalizeConversationExtraCompatibility({ ...existing.extra, ...updates.extra }),
        } as Partial<TChatConversation>;
      }
    } else if (updates.extra) {
      finalUpdates = {
        ...updates,
        extra: normalizeConversationExtraCompatibility(updates.extra),
      } as Partial<TChatConversation>;
    }
    await this.repo.updateConversation(id, finalUpdates);
  }

  async createWithMigration(params: MigrateConversationParams): Promise<TChatConversation> {
    const { conversation, sourceConversationId, migrateCron } = params;
    const conv: TChatConversation = {
      ...conversation,
      createTime: conversation.createTime ?? Date.now(),
      modifyTime: conversation.modifyTime ?? Date.now(),
    };
    await this.repo.createConversation(conv);

    if (sourceConversationId) {
      // Copy all messages from source conversation
      const pageSize = 10000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: messages, hasMore: more } = await this.repo.getMessages(sourceConversationId, page, pageSize);
        for (const msg of messages) {
          await this.repo.insertMessage({
            ...msg,
            id: uuid(),
            conversation_id: conv.id,
          });
        }
        hasMore = more;
        page++;
      }

      // Migrate or delete cron jobs associated with source conversation
      try {
        const jobs = await cronService.listJobsByConversation(sourceConversationId);
        if (migrateCron) {
          for (const job of jobs) {
            await cronService.updateJob(job.id, {
              metadata: {
                ...job.metadata,
                conversationId: conv.id,
                conversationTitle: conv.name,
              },
            });
          }
        } else {
          for (const job of jobs) {
            await cronService.removeJob(job.id);
          }
        }
      } catch (err) {
        console.error('[ConversationServiceImpl] Failed to handle cron jobs during migration:', err);
      }

      // Integrity check: only delete source if message counts match
      const sourceMsgs = await this.repo.getMessages(sourceConversationId, 0, 1);
      const newMsgs = await this.repo.getMessages(conv.id, 0, 1);
      if (sourceMsgs.total === newMsgs.total) {
        await this.repo.deleteConversation(sourceConversationId);
      } else {
        console.error('[ConversationServiceImpl] Migration integrity check failed: message counts do not match.', {
          source: sourceMsgs.total,
          new: newMsgs.total,
        });
      }
    }

    return conv;
  }

  async createConversation(params: CreateConversationParams): Promise<TChatConversation> {
    const resolvedSpaceId = params.extra.spaceId ?? (await this.spaceService.ensureDefaultSpace()).id;
    const normalizedParams: CreateConversationParams = {
      ...params,
      extra: normalizeConversationExtraCompatibility({
        ...params.extra,
        spaceId: resolvedSpaceId,
      }) as CreateConversationParams['extra'],
    };
    let conversation: TChatConversation;
    const requestedWorkingDirectory = normalizedParams.extra.workingDirectory || normalizedParams.extra.workspace;

    switch (normalizedParams.type) {
      case 'gemini': {
        conversation = await createGeminiAgent(
          normalizedParams.model,
          normalizedParams.extra.workspace,
          normalizedParams.extra.defaultFiles as string[] | undefined,
          normalizedParams.extra.webSearchEngine,
          normalizedParams.extra.customWorkspace,
          normalizedParams.extra.contextFileName,
          normalizedParams.extra.presetRules,
          normalizedParams.extra.enabledSkills as string[] | undefined,
          normalizedParams.extra.enabledHooks as string[] | undefined,
          normalizedParams.extra.presetAssistantId,
          normalizedParams.extra.sessionMode,
          normalizedParams.extra.isHealthCheck,
          normalizedParams.extra.spaceId,
          normalizedParams.extra.mountId,
          requestedWorkingDirectory
        );
        break;
      }
      case 'acp': {
        conversation = await createAcpAgent(normalizedParams as any);
        break;
      }
      case 'codex': {
        conversation = await createCodexAgent(normalizedParams as any);
        break;
      }
      case 'openclaw-gateway': {
        conversation = await createOpenClawAgent(normalizedParams as any);
        break;
      }
      case 'nanobot': {
        conversation = await createNanobotAgent(normalizedParams as any);
        break;
      }
      case 'group': {
        const orchestration = normalizedParams.extra.orchestration || {
          mode: 'debate',
          rounds: 2 as const,
        };
        conversation = await createGroupConversation({
          id: normalizedParams.id,
          name: normalizedParams.name,
          model: normalizedParams.model,
          spaceId: normalizedParams.extra.spaceId,
          mountId: normalizedParams.extra.mountId,
          workingDirectory: requestedWorkingDirectory,
          workspace: normalizedParams.extra.workspace,
          customWorkspace: normalizedParams.extra.customWorkspace,
          participants: (normalizedParams.extra.participants || []) as DiscussionGroupParticipant[],
          orchestration: {
            mode: orchestration.mode,
            rounds: orchestration.rounds || (orchestration.mode === 'debate' ? 2 : 1),
          },
        });
        break;
      }
      default: {
        throw new Error(`Invalid conversation type: ${(params as any).type}`);
      }
    }

    // Apply optional overrides without mutating the object returned by agent factories
    const overrides: Partial<TChatConversation> = {};
    if (normalizedParams.id) overrides.id = normalizedParams.id;
    if (normalizedParams.name) overrides.name = normalizedParams.name;
    if (normalizedParams.source) overrides.source = normalizedParams.source;
    if (normalizedParams.channelChatId) overrides.channelChatId = normalizedParams.channelChatId;
    // The spread preserves the discriminant field (type) from `conversation`;
    // the assertion is safe because `overrides` only contains non-discriminant fields.
    const finalConversation = {
      ...conversation,
      extra: normalizeConversationExtraCompatibility({
        ...normalizedParams.extra,
        ...conversation.extra,
      }),
      ...overrides,
    } as TChatConversation;

    await this.repo.createConversation(finalConversation);
    return finalConversation;
  }
}
