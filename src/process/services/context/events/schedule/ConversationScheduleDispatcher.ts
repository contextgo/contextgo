/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ScheduleMessageMeta } from '@/common/chat/chatLib';
import type { TChatConversation } from '@/common/config/storage';
import { uuid } from '@/common/utils';
import { AssistantHookRuntime } from '@process/bridge/services/AssistantHookRuntime';
import type { IConversationRepository } from '@process/services/database/IConversationRepository';
import { scheduleConversationGuard } from '@process/services/context/events/schedule/ScheduleConversationGuard';
import type BaseAgentManager from '@process/task/BaseAgentManager';
import type { IAgentManager } from '@process/task/IAgentManager';
import type { IWorkerTaskManager } from '@process/task/IWorkerTaskManager';
import { copyFilesToDirectory } from '@process/utils';
import type { ContextSchedule } from './types';

function assertConversationSchedule(schedule: ContextSchedule): asserts schedule is ContextSchedule & {
  target: Extract<ContextSchedule['target'], { kind: 'send_query' }>;
} {
  if (schedule.target.kind !== 'send_query') {
    throw new Error(`Schedule ${schedule.id} is not a conversation query target`);
  }
}

export class ConversationScheduleDispatcher {
  private readonly resolveTaskManager: () => IWorkerTaskManager;

  constructor(
    taskManager: IWorkerTaskManager | (() => IWorkerTaskManager),
    private readonly conversationRepo: IConversationRepository,
    private readonly hookRuntime: Pick<AssistantHookRuntime, 'applyBeforeUserPrompt'> = new AssistantHookRuntime()
  ) {
    this.resolveTaskManager = typeof taskManager === 'function' ? taskManager : () => taskManager;
  }

  isConversationBusy(conversationId: string): boolean {
    return scheduleConversationGuard.isProcessing(conversationId);
  }

  onceIdle(conversationId: string, callback: () => Promise<void>): void {
    scheduleConversationGuard.onceIdle(conversationId, callback);
  }

  async executeSchedule(
    schedule: ContextSchedule,
    onAcquired?: (conversation: TChatConversation) => void
  ): Promise<void> {
    assertConversationSchedule(schedule);

    const taskManager = this.resolveTaskManager();
    const conversationId = schedule.target.conversationId;
    const conversation = await this.conversationRepo.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const existingTask = taskManager.getTask(conversationId);
    let task: IAgentManager;

    if (existingTask) {
      const yoloEnabled = await (existingTask as BaseAgentManager<unknown>).ensureYoloMode();
      if (yoloEnabled) {
        task = existingTask;
      } else {
        taskManager.kill(conversationId);
        task = await taskManager.getOrBuildTask(conversationId, { yoloMode: true });
      }
    } else {
      task = await taskManager.getOrBuildTask(conversationId, { yoloMode: true });
    }

    scheduleConversationGuard.setProcessing(conversationId, true);
    onAcquired?.(conversation);

    const workspace = (task as { workspace?: string }).workspace;
    const workspaceFiles = workspace ? await copyFilesToDirectory(workspace, [], false) : [];
    const scheduleMeta: ScheduleMessageMeta = {
      source: 'schedule',
      scheduleJobId: schedule.id,
      scheduleJobName: schedule.name,
      triggeredAt: Date.now(),
    };
    const { content: transformedMessage } = await this.hookRuntime.applyBeforeUserPrompt(
      conversation,
      schedule.target.message
    );
    const msgId = uuid();

    if (task.type === 'codex' || task.type === 'acp') {
      await task.sendMessage({
        content: schedule.target.message,
        agentContent: transformedMessage,
        msg_id: msgId,
        files: workspaceFiles,
        scheduleMeta,
      });
      return;
    }

    await task.sendMessage({
      input: schedule.target.message,
      agentInput: transformedMessage,
      msg_id: msgId,
      files: workspaceFiles,
      scheduleMeta,
    });
  }
}
