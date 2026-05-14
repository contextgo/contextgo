/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IConversationTurnCompletedEvent } from '@/common/adapter/ipcBridge';
import type { IMessageText } from '@/common/chat/chatLib';
import type {
  CollaborationParticipantRole,
  DiscussionGroupMode,
  DiscussionGroupParticipant,
  DiscussionGroupOrchestration,
  GroupCollaborationConfig,
  MessageGroupMeta,
} from '@/common/config/storage';
import { isHarnessArtifactRole, uuid, type HarnessArtifactEntry, type HarnessArtifactStatus } from '@/common/utils';
import { getChannelMessageService } from '@process/channels/agent/ChannelMessageService';
import type { IConversationService } from '@process/services/IConversationService';
import {
  collectTextMessageContent,
  emitGroupTurnState,
  persistGroupProjectedMessage,
  persistGroupUserMessage,
  type GroupConversation,
} from '../shared';
import { normalizeStoredDiscussionOrchestration } from '../orchestration';
import {
  buildDiscussionFinalSynthesisContent,
  buildDiscussionRoundPrompt,
  buildDiscussionRoundSummaryContent,
  normalizeGroupCollaboration,
  type DiscussionRoundSummary,
} from './discussionHelpers';
import { persistHarnessArtifacts } from './discussionArtifacts';

class DiscussionGroupCancelledError extends Error {
  constructor(conversationId: string) {
    super(`Discussion group cancelled: ${conversationId}`);
    this.name = 'DiscussionGroupCancelledError';
  }
}

const buildProjectedMessageMeta = (
  participant: DiscussionGroupParticipant,
  childConversationId: string,
  orchestration: DiscussionGroupOrchestration,
  round: number
): MessageGroupMeta => {
  return {
    kind: 'discussion',
    participantId: participant.id,
    participantName: participant.name,
    participantAvatar: participant.avatar,
    participantRole: participant.role,
    childConversationId,
    mode: orchestration.mode,
    round,
  };
};

const buildDiscussionSummaryMeta = (
  _conversation: GroupConversation,
  orchestration: DiscussionGroupOrchestration,
  round: number,
  summaryKind: 'round' | 'final'
): MessageGroupMeta => {
  return {
    kind: 'discussion',
    participantId: summaryKind === 'final' ? 'group-final-summary' : `group-round-summary:${round}`,
    participantName: summaryKind === 'final' ? 'Group Synthesis' : `Round ${round} Summary`,
    mode: orchestration.mode,
    round,
    summaryKind,
  };
};

export class DiscussionGroupRuntime {
  private readonly activeChildConversationIdByGroup = new Map<string, string>();
  private readonly cancelledGroupIds = new Set<string>();

  constructor(private readonly conversationService: IConversationService) {}

  async stopConversation(conversationId: string): Promise<void> {
    this.cancelledGroupIds.add(conversationId);
    const activeChildConversationId = this.activeChildConversationIdByGroup.get(conversationId);
    if (!activeChildConversationId) {
      return;
    }

    await getChannelMessageService().stopStreaming(activeChildConversationId);
  }

  async sendMessage(
    conversation: GroupConversation,
    options: { conversationId: string; input: string; msgId: string }
  ): Promise<void> {
    this.cancelledGroupIds.delete(conversation.id);
    const orchestration = normalizeStoredDiscussionOrchestration(conversation.extra.orchestration);
    const collaboration = normalizeGroupCollaboration(conversation.extra.collaboration);
    this.validateCollaborationBoundary(collaboration);

    await persistGroupUserMessage(this.conversationService, conversation, {
      id: options.msgId,
      type: 'text',
      msg_id: options.msgId,
      conversation_id: conversation.id,
      position: 'right',
      content: {
        content: options.input,
      },
      createdAt: Date.now(),
    });

    ipcBridge.conversation.responseStream.emit({
      type: 'start',
      data: null,
      msg_id: options.msgId,
      conversation_id: conversation.id,
    });

    await this.conversationService.updateConversation(conversation.id, { status: 'running' });
    this.emitTurnState(conversation, 'running', 'ai_generating', 'Discussion group is responding');

    const harnessEntries: HarnessArtifactEntry[] = [];

    try {
      await this.persistHarnessArtifactsSafe({
        conversation,
        collaboration,
        orchestrationMode: orchestration.mode,
        request: options.input,
        entries: harnessEntries,
        status: 'running',
      });

      let previousRoundSummariesByParticipant = new Map<string, DiscussionRoundSummary>();
      let finalRoundSummaries: DiscussionRoundSummary[] = [];

      /* eslint-disable no-await-in-loop -- Discussion turns and projected summaries must remain in deterministic group order. */
      for (let round = 1; round <= orchestration.rounds; round += 1) {
        this.throwIfCancelled(conversation.id);
        const currentRoundSummariesByParticipant = new Map<string, DiscussionRoundSummary>();

        for (const [participantIndex, participant] of conversation.extra.participants.entries()) {
          this.throwIfCancelled(conversation.id);

          const peerSummaries =
            orchestration.mode === 'relay'
              ? conversation.extra.participants
                  .slice(0, participantIndex)
                  .map((item) => currentRoundSummariesByParticipant.get(item.id))
                  .filter((item): item is DiscussionRoundSummary => Boolean(item))
              : round <= 1
                ? []
                : conversation.extra.participants
                    .filter((item) => item.id !== participant.id)
                    .map((item) => previousRoundSummariesByParticipant.get(item.id))
                    .filter((item): item is DiscussionRoundSummary => Boolean(item));

          const promptParticipantRole: CollaborationParticipantRole | undefined =
            participant.role === 'participant'
              ? 'participant'
              : isHarnessArtifactRole(participant.role)
                ? participant.role
                : undefined;

          const prompt = buildDiscussionRoundPrompt({
            collaboration,
            mode: orchestration.mode,
            round,
            userInput: options.input,
            participantName: participant.name,
            participantRole: promptParticipantRole,
            peerSummaries,
          });

          const latestMessages = await this.collectParticipantRoundMessages(conversation, participant, prompt, round);
          this.throwIfCancelled(conversation.id);
          const summaryText = collectTextMessageContent(latestMessages);
          const participantRole = participant.role;

          if (summaryText) {
            currentRoundSummariesByParticipant.set(participant.id, {
              participantId: participant.id,
              participantName: participant.name,
              content: summaryText,
            });

            if (isHarnessArtifactRole(participantRole)) {
              this.upsertHarnessArtifactEntry(harnessEntries, {
                round,
                role: participantRole,
                participantId: participant.id,
                participantName: participant.name,
                summary: summaryText,
                updatedAt: Date.now(),
              });
              await this.persistHarnessArtifactsSafe({
                conversation,
                collaboration,
                orchestrationMode: orchestration.mode,
                request: options.input,
                entries: harnessEntries,
                status: 'running',
              });
            }
          }
        }

        previousRoundSummariesByParticipant = currentRoundSummariesByParticipant;
        finalRoundSummaries = [...currentRoundSummariesByParticipant.values()];

        if (finalRoundSummaries.length > 0) {
          await persistGroupProjectedMessage(
            this.conversationService,
            conversation,
            {
              id: uuid(),
              type: 'text',
              msg_id: `group-round-summary:${options.msgId}:${round}`,
              conversation_id: conversation.id,
              position: 'left',
              content: {
                content: buildDiscussionRoundSummaryContent({
                  round,
                  summaries: finalRoundSummaries,
                }),
                groupMeta: buildDiscussionSummaryMeta(conversation, orchestration, round, 'round'),
              },
              createdAt: Date.now(),
            },
            false
          );
        }
      }

      if (finalRoundSummaries.length > 0) {
        await persistGroupProjectedMessage(
          this.conversationService,
          conversation,
          {
            id: uuid(),
            type: 'text',
            msg_id: `group-final-summary:${options.msgId}`,
            conversation_id: conversation.id,
            position: 'left',
            content: {
              content: buildDiscussionFinalSynthesisContent({
                userInput: options.input,
                roundSummaries: finalRoundSummaries,
              }),
              groupMeta: buildDiscussionSummaryMeta(conversation, orchestration, orchestration.rounds, 'final'),
            },
            createdAt: Date.now(),
          },
          false
        );
      }
      /* eslint-enable no-await-in-loop */

      await this.persistHarnessArtifactsSafe({
        conversation,
        collaboration,
        orchestrationMode: orchestration.mode,
        request: options.input,
        entries: harnessEntries,
        status: 'finished',
      });
      await this.conversationService.updateConversation(conversation.id, { status: 'finished' });
      this.emitTurnState(conversation, 'finished', 'ai_waiting_input', 'Discussion group completed');
      ipcBridge.conversation.responseStream.emit({
        type: 'finish',
        data: null,
        msg_id: options.msgId,
        conversation_id: conversation.id,
      });
    } catch (error) {
      if (error instanceof DiscussionGroupCancelledError) {
        await this.persistHarnessArtifactsSafe({
          conversation,
          collaboration,
          orchestrationMode: orchestration.mode,
          request: options.input,
          entries: harnessEntries,
          status: 'stopped',
        });
        await this.conversationService.updateConversation(conversation.id, { status: 'finished' });
        this.emitTurnState(conversation, 'finished', 'ai_waiting_input', 'Discussion group stopped');
        ipcBridge.conversation.responseStream.emit({
          type: 'finish',
          data: null,
          msg_id: options.msgId,
          conversation_id: conversation.id,
        });
        return;
      }

      await this.persistHarnessArtifactsSafe({
        conversation,
        collaboration,
        orchestrationMode: orchestration.mode,
        request: options.input,
        entries: harnessEntries,
        status: 'error',
      });
      await this.conversationService.updateConversation(conversation.id, { status: 'finished' });
      const message = error instanceof Error ? error.message : String(error);

      await persistGroupProjectedMessage(
        this.conversationService,
        conversation,
        {
          id: uuid(),
          type: 'text',
          msg_id: `group-error:${options.msgId}`,
          conversation_id: conversation.id,
          position: 'left',
          content: {
            content: message,
            groupMeta: {
              kind: 'discussion',
              participantId: 'group-error',
              participantName: conversation.name || 'Group',
              mode: orchestration.mode,
              round: 0,
            },
          },
          createdAt: Date.now(),
        },
        true
      );
      this.emitTurnState(conversation, 'finished', 'error', message);
      ipcBridge.conversation.responseStream.emit({
        type: 'finish',
        data: null,
        msg_id: options.msgId,
        conversation_id: conversation.id,
      });
      throw error;
    } finally {
      this.activeChildConversationIdByGroup.delete(conversation.id);
      this.cancelledGroupIds.delete(conversation.id);
    }
  }

  private async collectParticipantRoundMessages(
    groupConversation: GroupConversation,
    participant: DiscussionGroupParticipant,
    prompt: string,
    round: number
  ): Promise<IMessageText[]> {
    const messageService = getChannelMessageService();
    const latestTextByMessageId = new Map<string, IMessageText>();
    const orderedMessageIds: string[] = [];
    const fallbackTexts: string[] = [];
    const orchestration = normalizeStoredDiscussionOrchestration(groupConversation.extra.orchestration);

    this.activeChildConversationIdByGroup.set(groupConversation.id, participant.childConversationId);

    await messageService.sendMessage(groupConversation.id, participant.childConversationId, prompt, (chunk) => {
      if (chunk.type === 'text' && chunk.position === 'left') {
        const messageId = chunk.msg_id || chunk.id;
        if (!latestTextByMessageId.has(messageId)) {
          orderedMessageIds.push(messageId);
        }
        latestTextByMessageId.set(messageId, {
          ...chunk,
          conversation_id: groupConversation.id,
          msg_id: `group:${participant.id}:round:${round}:${messageId}`,
          content: {
            ...chunk.content,
            groupMeta: buildProjectedMessageMeta(participant, participant.childConversationId, orchestration, round),
          },
        });
        return;
      }

      if (chunk.type === 'tips') {
        fallbackTexts.push(chunk.content.content);
      }
    });

    const projectedMessages = orderedMessageIds
      .map((messageId) => latestTextByMessageId.get(messageId))
      .filter((message): message is IMessageText => Boolean(message));

    if (projectedMessages.length === 0 && fallbackTexts.length > 0) {
      projectedMessages.push({
        id: uuid(),
        type: 'text',
        msg_id: `group:${participant.id}:round:${round}:fallback`,
        conversation_id: groupConversation.id,
        position: 'left',
        content: {
          content: fallbackTexts.join('\n\n'),
          groupMeta: buildProjectedMessageMeta(participant, participant.childConversationId, orchestration, round),
        },
        createdAt: Date.now(),
      });
    }

    /* eslint-disable no-await-in-loop -- Group projected messages should preserve participant output order. */
    for (const message of projectedMessages) {
      await persistGroupProjectedMessage(this.conversationService, groupConversation, message, false);
    }
    /* eslint-enable no-await-in-loop */

    return projectedMessages;
  }

  private validateCollaborationBoundary(collaboration: GroupCollaborationConfig): void {
    if (collaboration.mode !== 'planner-generator-evaluator') {
      return;
    }

    if (
      collaboration.executionBoundary.type !== 'git-repository' ||
      !collaboration.executionBoundary.repositoryRoot.trim()
    ) {
      throw new Error('Planner/Generator/Evaluator mode requires a git repository boundary.');
    }
  }

  private async persistHarnessArtifactsSafe(options: {
    conversation: GroupConversation;
    collaboration: GroupCollaborationConfig;
    orchestrationMode: DiscussionGroupMode;
    request: string;
    entries: HarnessArtifactEntry[];
    status: HarnessArtifactStatus;
  }): Promise<void> {
    if (options.collaboration.mode !== 'planner-generator-evaluator') {
      return;
    }

    try {
      await persistHarnessArtifacts({
        workspace: options.conversation.extra.workspace,
        conversationId: options.conversation.id,
        request: options.request,
        orchestrationMode: options.orchestrationMode,
        executionBoundary: options.collaboration.executionBoundary,
        status: options.status,
        entries: options.entries,
      });
    } catch (error) {
      console.error('[DiscussionGroupRuntime] Failed to persist harness artifacts:', error);
    }
  }

  private upsertHarnessArtifactEntry(entries: HarnessArtifactEntry[], nextEntry: HarnessArtifactEntry): void {
    const existingEntryIndex = entries.findIndex(
      (entry) => entry.round === nextEntry.round && entry.role === nextEntry.role
    );

    if (existingEntryIndex >= 0) {
      entries[existingEntryIndex] = nextEntry;
      return;
    }

    entries.push(nextEntry);
  }

  private throwIfCancelled(conversationId: string): void {
    if (this.cancelledGroupIds.has(conversationId)) {
      throw new DiscussionGroupCancelledError(conversationId);
    }
  }

  private emitTurnState(
    conversation: GroupConversation,
    status: IConversationTurnCompletedEvent['status'],
    state: IConversationTurnCompletedEvent['state'],
    detail: string
  ): void {
    emitGroupTurnState(conversation, status, state, detail);
  }
}
