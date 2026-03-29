/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IGroupConversationCreateParams } from '@/common/adapter/ipcBridge';
import type { GroupParticipant, TChatConversation, WorkflowGroupRunState } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import type { IConversationService } from '@process/services/IConversationService';
import type { IWorkerTaskManager } from '@process/task/IWorkerTaskManager';
import { DiscussionGroupRuntime } from './discussion/DiscussionGroupRuntime';
import { normalizeStoredGroupOrchestration } from './orchestration';
import { isGroupConversation, type GroupConversation } from './shared';
import { WorkflowGroupRuntime } from './workflow/WorkflowGroupRuntime';
import { normalizeWorkflowParticipants } from './workflow/workflowHelpers';
import { getWorkflowRuntimeTemplate } from './workflow/templates';

export class GroupConversationService {
  private readonly discussionRuntime: DiscussionGroupRuntime;
  private readonly workflowRuntime: WorkflowGroupRuntime;

  constructor(
    private readonly conversationService: IConversationService,
    private readonly workerTaskManager: IWorkerTaskManager
  ) {
    this.discussionRuntime = new DiscussionGroupRuntime(conversationService);
    this.workflowRuntime = new WorkflowGroupRuntime(conversationService);
  }

  private buildInitialWorkflowRunState(
    conversation: Pick<GroupConversation, 'extra'>,
    participants: GroupParticipant[]
  ): WorkflowGroupRunState {
    const orchestration = normalizeStoredGroupOrchestration(conversation.extra.orchestration);
    if (orchestration.kind !== 'workflow') {
      throw new Error('Workflow run state requested for a non-workflow group.');
    }

    return getWorkflowRuntimeTemplate(orchestration.template).buildInitialRunState(orchestration, participants);
  }

  async recoverAbandonedWorkflowRuns(): Promise<void> {
    const conversations = await this.conversationService.listAllConversations();

    await Promise.all(
      conversations.filter(isGroupConversation).map(async (conversation) => {
        const orchestration = normalizeStoredGroupOrchestration(conversation.extra.orchestration);
        if (orchestration.kind !== 'workflow') {
          return;
        }

        const runState = conversation.extra.runState;
        if (conversation.status !== 'running' && runState?.status !== 'running') {
          return;
        }

        const initialRunState = this.buildInitialWorkflowRunState(conversation, conversation.extra.participants);
        const nextRunState: WorkflowGroupRunState = {
          ...initialRunState,
          ...runState,
          status: 'failed',
          stage: 'failed',
          activeStageId: undefined,
          artifactPath: runState?.artifactPath || orchestration.artifactPath,
          activeParticipantId: undefined,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        };

        await this.conversationService.updateConversation(
          conversation.id,
          {
            status: 'finished',
            extra: {
              runState: nextRunState,
            },
          } as Partial<TChatConversation>,
          true
        );
      })
    );
  }

  async createConversation(
    params: IGroupConversationCreateParams & {
      source?: TChatConversation['source'];
      channelChatId?: string;
    }
  ): Promise<GroupConversation> {
    const parentId = params.id || uuid();
    const orchestration = normalizeStoredGroupOrchestration(params.extra.orchestration);
    const participantsToCreate =
      orchestration.kind === 'workflow'
        ? normalizeWorkflowParticipants(params.extra.participants, orchestration.template)
        : params.extra.participants;
    const initialRunState =
      orchestration.kind === 'workflow'
        ? getWorkflowRuntimeTemplate(orchestration.template).buildInitialRunState(orchestration, participantsToCreate)
        : undefined;

    const parentConversation = await this.conversationService.createConversation({
      type: 'group',
      id: parentId,
      name: params.name,
      model: params.model,
      source: params.source,
      channelChatId: params.channelChatId,
      extra: {
        workspace: params.extra.workspace,
        customWorkspace: params.extra.customWorkspace,
        participants: [],
        orchestration,
        runState: initialRunState,
      },
    });

    const participants: GroupParticipant[] = [];

    try {
      /* eslint-disable no-await-in-loop -- Child conversations inherit parent workspace and are created in participant order. */
      for (const participant of participantsToCreate) {
        const childConversation = await this.conversationService.createConversation({
          ...participant.conversation,
          name: participant.name,
          source: params.source,
          channelChatId: params.channelChatId,
          extra: {
            ...participant.conversation.extra,
            workspace: parentConversation.extra.workspace,
            customWorkspace: parentConversation.extra.customWorkspace,
            groupMeta: {
              parentGroupId: parentId,
              participantId: participant.id,
              participantName: participant.name,
              participantAvatar: participant.avatar,
              participantRole: participant.role,
              hiddenFromHistory: true,
            },
          },
        });

        participants.push({
          id: participant.id,
          participantType: participant.participantType,
          participantKey: participant.participantKey,
          assistantId: participant.assistantId,
          name: participant.name,
          avatar: participant.avatar,
          description: participant.description,
          childConversationId: childConversation.id,
          role: participant.role,
        });
      }
      /* eslint-enable no-await-in-loop */
    } catch (error) {
      await Promise.all(
        participants.map((participant) => this.conversationService.deleteConversation(participant.childConversationId))
      );
      await this.conversationService.deleteConversation(parentConversation.id);
      throw error;
    }

    const nextExtra: GroupConversation['extra'] = {
      ...parentConversation.extra,
      participants,
      orchestration,
      ...(orchestration.kind === 'workflow'
        ? {
            runState: getWorkflowRuntimeTemplate(orchestration.template).buildInitialRunState(
              orchestration,
              participants
            ),
          }
        : {}),
    };

    await this.conversationService.updateConversation(parentConversation.id, {
      extra: nextExtra,
    });

    return {
      ...parentConversation,
      extra: nextExtra,
    } as GroupConversation;
  }

  async deleteConversation(conversation: GroupConversation): Promise<void> {
    /* eslint-disable no-await-in-loop -- Child conversations should be cleaned up deterministically with worker shutdown. */
    for (const participant of conversation.extra.participants) {
      this.workerTaskManager.kill(participant.childConversationId);
      await this.conversationService.deleteConversation(participant.childConversationId);
    }
    /* eslint-enable no-await-in-loop */
    await this.conversationService.deleteConversation(conversation.id);
  }

  async stopConversation(conversationId: string): Promise<void> {
    const conversation = await this.conversationService.getConversation(conversationId);
    if (!isGroupConversation(conversation)) {
      return;
    }

    const orchestration = normalizeStoredGroupOrchestration(conversation.extra.orchestration);

    if (orchestration.kind === 'workflow') {
      await this.workflowRuntime.stopConversation(conversationId);
      return;
    }

    await this.discussionRuntime.stopConversation(conversationId);
  }

  async sendMessage(options: { conversationId: string; input: string; msgId: string }): Promise<void> {
    const conversation = await this.conversationService.getConversation(options.conversationId);
    if (!isGroupConversation(conversation)) {
      throw new Error(`Group conversation not found: ${options.conversationId}`);
    }

    if (conversation.status === 'running') {
      throw new Error(`Group conversation is already running: ${options.conversationId}`);
    }

    const orchestration = normalizeStoredGroupOrchestration(conversation.extra.orchestration);

    if (orchestration.kind === 'workflow') {
      await this.workflowRuntime.sendMessage(conversation, options);
      return;
    }

    await this.discussionRuntime.sendMessage(conversation, options);
  }
}
