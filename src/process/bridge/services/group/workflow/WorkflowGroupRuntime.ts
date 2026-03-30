/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IMessageText } from '@/common/chat/chatLib';
import { getWorkflowTemplateStageDefinitions, type WorkflowTemplateStageDefinition } from '@/common/config/group';
import type {
  GroupParticipant,
  MessageGroupMeta,
  WorkflowGroupDecision,
  WorkflowGroupOrchestration,
  WorkflowGroupStage,
} from '@/common/config/storage';
import { uuid } from '@/common/utils';
import { getChannelMessageService } from '@process/channels/agent/ChannelMessageService';
import type { IConversationService } from '@process/services/IConversationService';
import fs from 'fs/promises';
import path from 'path';
import {
  collectTextMessageContent,
  emitGroupTurnState,
  persistGroupProjectedMessage,
  persistGroupUserMessage,
  updateGroupRunState,
  type GroupConversation,
} from '../shared';
import { normalizeStoredWorkflowOrchestration } from '../orchestration';
import {
  buildWorkflowExecutionState,
  extractWorkflowArtifactUpdate,
  finalizeWorkflowRunState,
  finalizeWorkflowStageHistory,
  formatWorkflowEvaluationForWriter,
  getWorkflowStageDefinition,
  normalizeWorkflowArtifactPath,
  parseWorkflowEvaluation,
  resolveWorkflowParticipantForStage,
  type WorkflowArtifactUpdate,
  type WorkflowEvaluation,
} from './workflowHelpers';
import { getWorkflowRuntimeTemplate } from './templates';

class WorkflowGroupCancelledError extends Error {
  constructor(conversationId: string) {
    super(`Workflow group cancelled: ${conversationId}`);
    this.name = 'WorkflowGroupCancelledError';
  }
}

const buildProjectedMessageMeta = (
  participant: GroupParticipant,
  childConversationId: string,
  orchestration: WorkflowGroupOrchestration,
  stage: WorkflowGroupStage,
  iteration: number
): MessageGroupMeta => {
  return {
    kind: 'workflow',
    participantId: participant.id,
    participantName: participant.name,
    participantAvatar: participant.avatar,
    childConversationId,
    participantRole: participant.role,
    template: orchestration.template,
    stage,
    iteration,
  };
};

const resolveArtifactAbsolutePath = (workspace: string, artifactPath: string): string => {
  return path.join(workspace, normalizeWorkflowArtifactPath(artifactPath));
};

const buildCompletionDetail = (
  decision: WorkflowGroupDecision | undefined,
  iteration: number,
  evaluation: WorkflowEvaluation | null
): string => {
  if (decision === 'accept') {
    return evaluation?.score !== undefined
      ? `Workflow group accepted the artifact at ${evaluation.score}/10 after iteration ${iteration}.`
      : `Workflow group accepted the artifact after iteration ${iteration}.`;
  }

  if (decision === 'stop') {
    return `Workflow group stopped after the evaluation stage on iteration ${iteration}.`;
  }

  if (iteration > 0) {
    return `Workflow group completed after reaching the iteration budget (${iteration}).`;
  }

  return 'Workflow group completed.';
};

const buildMissingArtifactError = (artifactPath: string): Error => {
  return new Error(
    `Workflow writing stage did not produce a materialized artifact at ${artifactPath}. Each writing turn must keep the exact [Artifact Path] and include a full [Artifact Content] block.`
  );
};

export class WorkflowGroupRuntime {
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
    const orchestration = normalizeStoredWorkflowOrchestration(conversation.extra.orchestration);
    const runtimeTemplate = getWorkflowRuntimeTemplate(orchestration.template);
    const stageDefinitions = getWorkflowTemplateStageDefinitions(orchestration.template);
    const artifactPath = normalizeWorkflowArtifactPath(orchestration.artifactPath);

    this.cancelledGroupIds.delete(conversation.id);

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

    let currentConversation = await updateGroupRunState(
      this.conversationService,
      conversation,
      {
        ...runtimeTemplate.buildInitialRunState(orchestration, conversation.extra.participants),
        status: 'running',
        startedAt: Date.now(),
        updatedAt: Date.now(),
      },
      'running'
    );

    emitGroupTurnState(currentConversation, 'running', 'ai_generating', 'Workflow group is running');

    let latestEvaluation: WorkflowEvaluation | null = null;
    let latestArtifactForEvaluation: string | undefined;
    let planningBrief = '';
    let completedIteration = 0;
    let activeStageId = currentConversation.extra.runState?.activeStageId || stageDefinitions[0]?.id;

    try {
      /* eslint-disable no-await-in-loop -- Workflow stages must run sequentially across a single run graph. */
      while (activeStageId) {
        const activeStage = getWorkflowStageDefinition(orchestration.template, activeStageId);
        if (!activeStage) {
          throw new Error(`Workflow template ${orchestration.template} is missing stage ${activeStageId}.`);
        }

        const participant = resolveWorkflowParticipantForStage(
          currentConversation.extra.participants,
          activeStage,
          orchestration.template
        );
        const iteration = activeStage.kind === 'writing' ? completedIteration + 1 : completedIteration;
        if (activeStage.kind === 'writing') {
          completedIteration = iteration;
        }

        currentConversation = await updateGroupRunState(
          this.conversationService,
          currentConversation,
          buildWorkflowExecutionState({
            runState: currentConversation.extra.runState!,
            stage: activeStage,
            participant,
            iteration,
            artifactPath,
            planningBrief,
            latestScore: latestEvaluation?.score,
            latestDecision: latestEvaluation?.decision,
            status: 'running',
          }),
          'running'
        );

        if (activeStage.kind === 'planning') {
          const plannerMessages = await this.collectParticipantStageMessages(
            currentConversation,
            participant,
            runtimeTemplate.buildPlannerPrompt({
              userInput: options.input,
              participantName: participant.name,
              roleId: participant.role,
              artifactPath,
              scoreTarget: orchestration.scoreTarget || 8,
              maxIterations: orchestration.maxIterations,
            }),
            activeStage.kind,
            iteration
          );
          this.throwIfCancelled(conversation.id);
          planningBrief =
            collectTextMessageContent(plannerMessages) ||
            'Planning stage did not provide a structured brief. Use the original request as the working brief.';
        } else if (activeStage.kind === 'writing') {
          const artifactBeforeWriting = await this.readArtifactContent(
            currentConversation.extra.workspace || '',
            artifactPath
          );
          const writerMessages = await this.collectParticipantStageMessages(
            currentConversation,
            participant,
            runtimeTemplate.buildWriterPrompt({
              userInput: options.input,
              participantName: participant.name,
              roleId: participant.role,
              artifactPath,
              iteration,
              planningBrief,
              artifactContent: artifactBeforeWriting,
              evaluatorFeedback: latestEvaluation ? formatWorkflowEvaluationForWriter(latestEvaluation) : undefined,
            }),
            activeStage.kind,
            iteration
          );
          this.throwIfCancelled(conversation.id);

          latestArtifactForEvaluation = await this.materializeArtifactForEvaluation({
            workspace: currentConversation.extra.workspace || '',
            artifactPath,
            artifactBeforeWriting,
            writerOutput: collectTextMessageContent(writerMessages),
          });
        } else {
          const evaluatorMessages = await this.collectParticipantStageMessages(
            currentConversation,
            participant,
            runtimeTemplate.buildEvaluatorPrompt({
              userInput: options.input,
              participantName: participant.name,
              roleId: participant.role,
              artifactPath,
              iteration,
              planningBrief,
              artifactContent: latestArtifactForEvaluation || '',
              scoreTarget: orchestration.scoreTarget || 8,
            }),
            activeStage.kind,
            iteration
          );
          this.throwIfCancelled(conversation.id);
          latestEvaluation = parseWorkflowEvaluation(
            collectTextMessageContent(evaluatorMessages),
            orchestration.scoreTarget || 8
          );
        }

        currentConversation = await updateGroupRunState(
          this.conversationService,
          currentConversation,
          {
            ...currentConversation.extra.runState!,
            planningBrief,
            latestScore: latestEvaluation?.score,
            latestDecision: latestEvaluation?.decision,
            stageHistory: finalizeWorkflowStageHistory(
              currentConversation.extra.runState!.stageHistory,
              activeStage.id,
              'completed'
            ),
            updatedAt: Date.now(),
          },
          'running'
        );

        activeStageId = this.resolveNextStageId({
          activeStage,
          stageDefinitions,
          orchestration,
          iteration: completedIteration,
          latestEvaluation,
          runtimeTemplate,
        });
      }
      /* eslint-enable no-await-in-loop */

      const finalDecision = runtimeTemplate.getFinalDecision({
        latestEvaluation,
        completedIteration,
        orchestration,
      });
      currentConversation = await updateGroupRunState(
        this.conversationService,
        currentConversation,
        finalizeWorkflowRunState({
          runState: currentConversation.extra.runState!,
          terminalStatus: finalDecision === 'stop' ? 'stopped' : 'completed',
          terminalStage: 'completed',
          iteration: completedIteration,
          artifactPath,
          latestScore: latestEvaluation?.score,
          latestDecision: finalDecision,
        }),
        'finished'
      );

      emitGroupTurnState(
        currentConversation,
        'finished',
        'ai_waiting_input',
        buildCompletionDetail(finalDecision, completedIteration, latestEvaluation)
      );
      ipcBridge.conversation.responseStream.emit({
        type: 'finish',
        data: null,
        msg_id: options.msgId,
        conversation_id: conversation.id,
      });
    } catch (error) {
      if (error instanceof WorkflowGroupCancelledError) {
        currentConversation = await updateGroupRunState(
          this.conversationService,
          currentConversation,
          finalizeWorkflowRunState({
            runState: {
              ...currentConversation.extra.runState!,
              stageHistory: currentConversation.extra.runState?.activeStageId
                ? finalizeWorkflowStageHistory(
                    currentConversation.extra.runState.stageHistory,
                    currentConversation.extra.runState.activeStageId,
                    'stopped'
                  )
                : currentConversation.extra.runState!.stageHistory,
            },
            terminalStatus: 'stopped',
            terminalStage: currentConversation.extra.runState?.stage || 'planning',
            iteration: currentConversation.extra.runState?.iteration ?? completedIteration,
            artifactPath,
          }),
          'finished'
        );
        emitGroupTurnState(currentConversation, 'finished', 'ai_waiting_input', 'Workflow group stopped');
        ipcBridge.conversation.responseStream.emit({
          type: 'finish',
          data: null,
          msg_id: options.msgId,
          conversation_id: conversation.id,
        });
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      currentConversation = await updateGroupRunState(
        this.conversationService,
        currentConversation,
        finalizeWorkflowRunState({
          runState: {
            ...currentConversation.extra.runState!,
            stageHistory: currentConversation.extra.runState?.activeStageId
              ? finalizeWorkflowStageHistory(
                  currentConversation.extra.runState.stageHistory,
                  currentConversation.extra.runState.activeStageId,
                  'failed'
                )
              : currentConversation.extra.runState!.stageHistory,
          },
          terminalStatus: 'failed',
          terminalStage: 'failed',
          iteration: currentConversation.extra.runState?.iteration ?? completedIteration,
          artifactPath,
        }),
        'finished'
      );
      await persistGroupProjectedMessage(
        this.conversationService,
        currentConversation,
        {
          id: uuid(),
          type: 'text',
          msg_id: `workflow-error:${options.msgId}`,
          conversation_id: conversation.id,
          position: 'left',
          content: {
            content: message,
            groupMeta: {
              kind: 'workflow',
              participantId: 'workflow-error',
              participantName: conversation.name || 'Group',
              template: orchestration.template,
              stage: 'failed',
              iteration: completedIteration,
            },
          },
          createdAt: Date.now(),
        },
        true
      );
      emitGroupTurnState(currentConversation, 'finished', 'error', message);
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

  private async collectParticipantStageMessages(
    groupConversation: GroupConversation,
    participant: GroupParticipant,
    prompt: string,
    stage: WorkflowGroupStage,
    iteration: number
  ): Promise<IMessageText[]> {
    const messageService = getChannelMessageService();
    const latestTextByMessageId = new Map<string, IMessageText>();
    const orderedMessageIds: string[] = [];
    const fallbackTexts: string[] = [];
    const orchestration = normalizeStoredWorkflowOrchestration(groupConversation.extra.orchestration);

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
          msg_id: `group:${participant.id}:${stage}:${iteration}:${messageId}`,
          content: {
            ...chunk.content,
            groupMeta: buildProjectedMessageMeta(
              participant,
              participant.childConversationId,
              orchestration,
              stage,
              iteration
            ),
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
        msg_id: `group:${participant.id}:${stage}:${iteration}:fallback`,
        conversation_id: groupConversation.id,
        position: 'left',
        content: {
          content: fallbackTexts.join('\n\n'),
          groupMeta: buildProjectedMessageMeta(
            participant,
            participant.childConversationId,
            orchestration,
            stage,
            iteration
          ),
        },
        createdAt: Date.now(),
      });
    }

    /* eslint-disable no-await-in-loop -- Projected messages must preserve stage order in history. */
    for (const message of projectedMessages) {
      await persistGroupProjectedMessage(this.conversationService, groupConversation, message, false);
    }
    /* eslint-enable no-await-in-loop */

    return projectedMessages;
  }

  private async readArtifactContent(workspace: string, artifactPath: string): Promise<string | undefined> {
    if (!workspace || !artifactPath) {
      return undefined;
    }

    try {
      return await fs.readFile(resolveArtifactAbsolutePath(workspace, artifactPath), 'utf-8');
    } catch {
      return undefined;
    }
  }

  private async writeArtifactContent(workspace: string, artifactPath: string, content: string): Promise<void> {
    const absoluteArtifactPath = resolveArtifactAbsolutePath(workspace, artifactPath);
    await fs.mkdir(path.dirname(absoluteArtifactPath), { recursive: true });
    await fs.writeFile(absoluteArtifactPath, content, 'utf-8');
  }

  private validateArtifactUpdate(
    artifactUpdate: WorkflowArtifactUpdate,
    artifactPath: string
  ): asserts artifactUpdate is WorkflowArtifactUpdate & {
    path: string;
    status: 'written' | 'proposed';
    content: string;
  } {
    if (!artifactUpdate.path) {
      throw new Error(
        `Workflow writing stage must include [Artifact Path] with the exact shared artifact path (${artifactPath}).`
      );
    }

    if (artifactUpdate.path !== artifactPath) {
      throw new Error(
        `Workflow writing stage returned artifact path ${artifactUpdate.path}, but the workflow contract requires ${artifactPath}.`
      );
    }

    if (!artifactUpdate.status) {
      throw new Error('Workflow writing stage must include [Artifact Status] set to written or proposed.');
    }

    if (!artifactUpdate.content) {
      throw new Error('Workflow writing stage must include [Artifact Content] with the full artifact body.');
    }
  }

  private async materializeArtifactForEvaluation(options: {
    workspace: string;
    artifactPath: string;
    artifactBeforeWriting?: string;
    writerOutput: string;
  }): Promise<string> {
    const { workspace, artifactPath, artifactBeforeWriting, writerOutput } = options;
    const artifactUpdate = extractWorkflowArtifactUpdate(writerOutput);
    this.validateArtifactUpdate(artifactUpdate, artifactPath);

    const artifactAfterWriting = await this.readArtifactContent(workspace, artifactPath);
    if (artifactAfterWriting?.trim() && artifactAfterWriting !== artifactBeforeWriting) {
      return artifactAfterWriting;
    }

    await this.writeArtifactContent(workspace, artifactPath, artifactUpdate.content);
    const materializedArtifact = await this.readArtifactContent(workspace, artifactPath);
    if (!materializedArtifact?.trim()) {
      throw buildMissingArtifactError(artifactPath);
    }

    return materializedArtifact;
  }

  private throwIfCancelled(conversationId: string): void {
    if (this.cancelledGroupIds.has(conversationId)) {
      throw new WorkflowGroupCancelledError(conversationId);
    }
  }

  private resolveNextStageId(options: {
    activeStage: WorkflowTemplateStageDefinition;
    stageDefinitions: WorkflowTemplateStageDefinition[];
    orchestration: WorkflowGroupOrchestration;
    iteration: number;
    latestEvaluation: WorkflowEvaluation | null;
    runtimeTemplate: ReturnType<typeof getWorkflowRuntimeTemplate>;
  }): string | undefined {
    const { activeStage, stageDefinitions, orchestration, iteration, latestEvaluation, runtimeTemplate } = options;
    const firstWritingStage = stageDefinitions.find((stage) => stage.kind === 'writing');
    const firstEvaluatingStage = stageDefinitions.find((stage) => stage.kind === 'evaluating');

    if (activeStage.kind === 'planning') {
      return activeStage.nextStageId || firstWritingStage?.id;
    }

    if (activeStage.kind === 'writing') {
      if (runtimeTemplate.shouldRunEvaluation({ iteration, orchestration })) {
        return activeStage.nextStageId || firstEvaluatingStage?.id;
      }

      if (iteration < orchestration.maxIterations) {
        return firstWritingStage?.id;
      }

      return activeStage.nextStageId || firstEvaluatingStage?.id;
    }

    if (latestEvaluation?.decision === 'continue' && iteration < orchestration.maxIterations) {
      return firstWritingStage?.id;
    }

    return undefined;
  }
}
