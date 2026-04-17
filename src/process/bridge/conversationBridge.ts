/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CodexAgentManager } from '@process/agent/codex';
import { GeminiAgent, GeminiApprovalStore } from '@process/agent/gemini';
import type { ICreateConversationParams, IDiscussionGroupCreateParams } from '@/common/adapter/ipcBridge';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import { mergeManagedSlashCommandLibraries, type ManagedSlashCommandRecord } from '@/common/chat/slash/library';
import { transformMessage } from '@/common/chat/chatLib';
import type { TChatConversation } from '@/common/config/storage';
import type { IAgentManager } from '@process/task/IAgentManager';
import type { IConversationService } from '@process/services/IConversationService';
import type { ISpaceService } from '@process/services/space/ISpaceService';
import type { IWorkerTaskManager } from '@process/task/IWorkerTaskManager';
import { ipcBridge } from '@/common';
import { uuid } from '@/common/utils';
import { getSkillsDir, getBuiltinSkillsCopyDir, getSystemDir, ProcessChat } from '@process/utils/initStorage';
import type AcpAgentManager from '../task/AcpAgentManager';
import type { GeminiAgentManager } from '../task/GeminiAgentManager';
import { prepareFirstMessage } from '../task/agentUtils';
import { refreshTrayMenu } from '@process/utils/tray';
import { copyFilesToDirectory, readDirectoryRecursive } from '@process/utils';
import { getDatabase } from '@process/services/database';
import i18n from '@process/services/i18n';
import { getExternalSessionControlState } from '@process/channels/types';
import { migrateConversationToDatabase } from './migrationUtils';
import { AssistantHookRuntime } from './services/AssistantHookRuntime';
import { GroupConversationService } from './services/group/GroupConversationService';
import { readWorkspaceCommandLibrary, resolveWorkspacePath } from './services/workspaceAutomation';
import { contextService, contextRuntimeService } from '@process/services/context/contextServiceSingleton';
import { addMessage } from '@process/utils/message';
import { ProjectCapabilityService } from '@process/services/space/ProjectCapabilityService';

const refreshTrayMenuSafely = async (): Promise<void> => {
  try {
    await refreshTrayMenu();
  } catch (error) {
    console.warn('[conversationBridge] Failed to refresh tray menu:', error);
  }
};

const emitConversationInterrupted = (conversation: Pick<TChatConversation, 'id' | 'type'>): void => {
  const interruptedMessage: IResponseMessage = {
    type: 'interrupted',
    conversation_id: conversation.id,
    msg_id: uuid(),
    data: i18n.t('messages.interrupted', {
      defaultValue: 'Interrupted by user.',
    }),
  };

  const transformedMessage = transformMessage(interruptedMessage);
  if (transformedMessage) {
    addMessage(conversation.id, transformedMessage);
  }

  ipcBridge.conversation.responseStream.emit(interruptedMessage);
};

function toContextMemoryCandidateView(
  candidate: import('../../../packages/context-engine/src/domain').MemoryCandidateEntry
) {
  return {
    ...candidate,
    promotionRationale: [...candidate.promotionRationale],
  };
}

function getConversationWorkspacePath(conversation?: TChatConversation): string | undefined {
  const extra = conversation?.extra as Record<string, unknown> | undefined;
  const workingDirectory = typeof extra?.workingDirectory === 'string' ? extra.workingDirectory : undefined;
  const workspace = typeof extra?.workspace === 'string' ? extra.workspace : undefined;
  return resolveWorkspacePath(workingDirectory || workspace);
}

function getConversationSpaceId(conversation?: TChatConversation): string | undefined {
  const spaceId = conversation?.extra?.spaceId;
  return typeof spaceId === 'string' && spaceId.trim() ? spaceId : undefined;
}

async function resolveManagedSlashCommandLibrary(
  conversation: TChatConversation | undefined,
  spaceService: ISpaceService
): Promise<ManagedSlashCommandRecord[]> {
  const spaceId = getConversationSpaceId(conversation);
  const workspacePath = getConversationWorkspacePath(conversation);
  const [spaceLibrary, workspaceLibrary] = await Promise.all([
    spaceId ? spaceService.getSpaceCommandLibrary(spaceId) : Promise.resolve<ManagedSlashCommandRecord[]>([]),
    workspacePath
      ? readWorkspaceCommandLibrary(workspacePath)
      : Promise.resolve<ManagedSlashCommandRecord[] | null>(null),
  ]);

  return mergeManagedSlashCommandLibraries([spaceLibrary, workspaceLibrary ?? []]);
}

export function initConversationBridge(
  conversationService: IConversationService,
  workerTaskManager: IWorkerTaskManager,
  spaceService: ISpaceService
): void {
  const assistantHookRuntime = new AssistantHookRuntime();
  const groupConversationService = new GroupConversationService(conversationService, workerTaskManager);
  void groupConversationService.recoverAbandonedWorkflowRuns().catch((error) => {
    console.error('[conversationBridge] Failed to recover abandoned workflow runs:', error);
  });
  const emitConversationListChanged = (
    conversation: Pick<TChatConversation, 'id' | 'source'>,
    action: 'created' | 'updated' | 'deleted'
  ) => {
    ipcBridge.conversation.listChanged.emit({
      conversationId: conversation.id,
      action,
      source: conversation.source || 'contextgo',
    });
  };

  const assertDesktopCanControl = async (conversation: TChatConversation): Promise<void> => {
    const db = await getDatabase();
    const externalSessionResult = conversation.externalSessionId
      ? db.getExternalSession(conversation.externalSessionId)
      : db.getExternalSessionByActiveConversation(conversation.id);
    if (!externalSessionResult.success || !externalSessionResult.data) {
      return;
    }
    const controlLeaseResult = db.getChannelControlLease(externalSessionResult.data.id);
    const control =
      controlLeaseResult.success && controlLeaseResult.data
        ? {
            ownerKey: controlLeaseResult.data.ownerKey,
            controlMode: controlLeaseResult.data.controlMode,
          }
        : getExternalSessionControlState(externalSessionResult.data);
    if (control.controlMode === 'im_owner') {
      throw new Error('This session is currently controlled from IM. Reclaim control before sending from desktop.');
    }
  };

  ipcBridge.conversation.create.provider(async (params: ICreateConversationParams): Promise<TChatConversation> => {
    const conversation =
      params.type === 'group'
        ? await groupConversationService.createConversation({
            ...(params as IDiscussionGroupCreateParams),
            source: 'contextgo',
          })
        : await conversationService.createConversation({
            ...params,
            source: 'contextgo', // Mark conversations created by ContextGo as contextgo
          });
    await contextRuntimeService.registerConversation(conversation);
    emitConversationListChanged(conversation, 'created');
    await refreshTrayMenuSafely();
    return conversation;
  });

  ipcBridge.conversation.listMemoryCandidates.provider(async ({ conversation_id, spaceId, state, reviewStatus }) => {
    try {
      let resolvedSpaceId = spaceId;
      let threadId: string | undefined;

      if (!resolvedSpaceId && conversation_id) {
        const conversation = await conversationService.getConversation(conversation_id);
        resolvedSpaceId = conversation?.extra?.spaceId;
        threadId = conversation?.id;
      }

      if (!resolvedSpaceId) {
        return { success: false, msg: 'space not found' };
      }

      const candidates = await contextService.listMemoryCandidates({
        spaceId: resolvedSpaceId,
        threadId,
        ...(state ? { state: state as any } : {}),
        ...(reviewStatus ? { reviewStatus: reviewStatus as any } : {}),
      });
      return { success: true, data: { candidates: candidates.map(toContextMemoryCandidateView) } };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcBridge.conversation.reviewMemoryCandidate.provider(async ({ candidateId, action, reviewerId }) => {
    try {
      const candidate =
        action === 'approve'
          ? await contextService.approveMemoryCandidate(candidateId, reviewerId)
          : await contextService.rejectMemoryCandidate(candidateId, reviewerId);
      return { success: true, data: { candidate: toContextMemoryCandidateView(candidate) } };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcBridge.conversation.promoteMemoryCandidate.provider(async ({ candidateId, destination, reviewerId }) => {
    try {
      const candidate = await contextService.promoteMemoryCandidateToDestination(candidateId, destination, reviewerId);
      return { success: true, data: { candidate: toContextMemoryCandidateView(candidate) } };
    } catch (error) {
      return { success: false, msg: error instanceof Error ? error.message : String(error) };
    }
  });

  // Manually reload conversation context (Gemini): inject recent history into memory
  ipcBridge.conversation.reloadContext.provider(async ({ conversation_id }) => {
    try {
      const task = (await workerTaskManager.getOrBuildTask(conversation_id)) as unknown as
        | GeminiAgentManager
        | AcpAgentManager
        | CodexAgentManager
        | undefined;
      if (!task) return { success: false, msg: 'conversation not found' };
      if (task.type !== 'gemini') return { success: false, msg: 'only supported for gemini' };

      await (task as GeminiAgentManager).reloadContext();
      return { success: true };
    } catch (e: unknown) {
      return {
        success: false,
        msg: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcBridge.conversation.getAssociateConversation.provider(async ({ conversation_id }) => {
    try {
      // Try to get current conversation via service
      let currentConversation: TChatConversation | undefined =
        await conversationService.getConversation(conversation_id);

      if (!currentConversation) {
        // Not in database, try file storage
        const history = await ProcessChat.get('chat.history');
        currentConversation = (history || []).find((item) => item.id === conversation_id);

        // Lazy migrate in background
        if (currentConversation) {
          void migrateConversationToDatabase(currentConversation);
        }
      }

      if (!currentConversation || !currentConversation.extra?.workspace) {
        return [];
      }

      let allConversations: TChatConversation[] = await conversationService.listAllConversations();

      // If database is empty or doesn't have enough conversations, merge with file storage
      const history = await ProcessChat.get('chat.history');
      if (allConversations.length < (history?.length || 0)) {
        // Database doesn't have all conversations yet, use file storage
        allConversations = history || [];

        // Lazy migrate all conversations in background
        void Promise.all(allConversations.map((conv) => migrateConversationToDatabase(conv)));
      }

      // Filter by workspace
      return allConversations.filter((item) => item.extra?.workspace === currentConversation.extra.workspace);
    } catch (error) {
      console.error('[conversationBridge] Failed to get associate conversations:', error);
      return [];
    }
  });

  ipcBridge.conversation.createWithConversation.provider(
    async ({ conversation, sourceConversationId, migrateSchedule, sourceWorkspace }) => {
      try {
        const result = await conversationService.createWithMigration({
          conversation,
          sourceConversationId,
          migrateSchedule,
          sourceWorkspace,
        });
        await contextRuntimeService.registerConversation(result);
        workerTaskManager.getOrBuildTask(result.id).catch((err) => {
          console.warn('[conversationBridge] Failed to pre-warm task after migration:', err);
        });
        emitConversationListChanged(result, 'created');
        if (sourceConversationId) {
          emitConversationListChanged({ id: sourceConversationId, source: conversation.source }, 'deleted');
        }
        await refreshTrayMenuSafely();
        return result;
      } catch (error) {
        console.error('[conversationBridge] Failed to create conversation with conversation:', error);
        return Promise.resolve(conversation);
      }
    }
  );

  ipcBridge.conversation.remove.provider(async ({ id }) => {
    try {
      // Get conversation source before deletion (for channel cleanup)
      const conversation = await conversationService.getConversation(id);
      const source = conversation?.source;

      // Kill the running task if exists
      workerTaskManager.kill(id);

      // If source is not 'contextgo' (e.g., telegram), cleanup channel resources
      // 如果来源不是 contextgo（如 telegram），需要清理 channel 相关资源
      if (source && source !== 'contextgo') {
        try {
          // Dynamic import to avoid circular dependency
          const { getChannelManager } = await import('@process/channels/core/ChannelManager');
          const channelManager = getChannelManager();
          if (channelManager.isInitialized()) {
            await channelManager.cleanupConversation(id);
          }
        } catch (cleanupError) {
          console.warn('[conversationBridge] Failed to cleanup channel resources:', cleanupError);
          // Continue with deletion even if cleanup fails
        }
      }

      if (conversation?.type === 'group') {
        await groupConversationService.deleteConversation(conversation);
      } else {
        await conversationService.deleteConversation(id);
      }
      if (conversation) {
        const remainingConversations = await conversationService.listAllConversations();
        await contextRuntimeService.removeConversationContext(conversation, remainingConversations);
      }
      if (conversation) {
        emitConversationListChanged(conversation, 'deleted');
      }
      await refreshTrayMenuSafely();
      return true;
    } catch (error) {
      console.error('[conversationBridge] Failed to remove conversation:', error);
      return false;
    }
  });

  ipcBridge.conversation.update.provider(
    async ({ id, updates, mergeExtra }: { id: string; updates: Partial<TChatConversation>; mergeExtra?: boolean }) => {
      try {
        const existing = await conversationService.getConversation(id);
        // Only gemini type has model, use 'in' check to safely access
        const prevModel = existing && 'model' in existing ? existing.model : undefined;
        const nextModel = 'model' in updates ? updates.model : undefined;
        const modelChanged = !!nextModel && JSON.stringify(prevModel) !== JSON.stringify(nextModel);
        const prevWorkspace = existing?.extra?.workingDirectory || existing?.extra?.workspace;
        const nextWorkspace = updates.extra?.workingDirectory || updates.extra?.workspace;
        const workspaceChanged =
          typeof nextWorkspace === 'string' &&
          nextWorkspace.length > 0 &&
          JSON.stringify(prevWorkspace) !== JSON.stringify(nextWorkspace);
        // runtime-affecting changes should force task rebuild

        await conversationService.updateConversation(id, updates, mergeExtra);

        if (existing) {
          emitConversationListChanged(existing, 'updated');
        }

        // If model changed, kill running task to force rebuild with new model on next send
        if (modelChanged || workspaceChanged) {
          try {
            workerTaskManager.kill(id);
          } catch {
            // ignore kill error, will lazily rebuild later
          }
        }

        if ('name' in updates) {
          await refreshTrayMenuSafely();
        }

        return true;
      } catch (error) {
        console.error('[conversationBridge] Failed to update conversation:', error);
        return false;
      }
    }
  );

  // Pre-warm conversation bootstrap: trigger getOrBuildTask early so that
  // the worker is ready when the user sends their first message.
  // For ACP agents, also trigger initAgent() to start the CLI subprocess
  // (~7s). Stream events are suppressed during bootstrap (via `bootstrapping`
  // flag) to avoid triggering the sidebar loading spinner prematurely.
  ipcBridge.conversation.warmup.provider(async ({ conversation_id }) => {
    try {
      const task = await workerTaskManager.getOrBuildTask(conversation_id);
      if (task && task.type === 'acp') {
        await (task as unknown as AcpAgentManager).initAgent();
      }
    } catch {
      // Ignore errors — warmup is best-effort
    }
  });

  ipcBridge.conversation.reset.provider(({ id }) => {
    if (id) {
      workerTaskManager.kill(id);
    } else {
      workerTaskManager.clear();
    }
    return Promise.resolve();
  });

  ipcBridge.conversation.get.provider(async ({ id }) => {
    try {
      // Try to get conversation from service (database)
      const conversation = await conversationService.getConversation(id);
      if (conversation) {
        // Found in database, update status and return
        const task = workerTaskManager.getTask(id);
        return { ...conversation, status: task?.status || 'finished' };
      }

      // Not in database, try to load from file storage and migrate
      const history = await ProcessChat.get('chat.history');
      const fileConversation = (history || []).find((item) => item.id === id);
      if (fileConversation) {
        // Update status from running task without mutating the file storage object
        const task = workerTaskManager.getTask(id);

        // Lazy migrate this conversation to database in background
        void migrateConversationToDatabase(fileConversation);

        return { ...fileConversation, status: task?.status || 'finished' };
      }

      return undefined;
    } catch (error) {
      console.error('[conversationBridge] Failed to get conversation:', error);
      return undefined;
    }
  });

  const projectCapabilityService = new ProjectCapabilityService();

  const buildLastAbortController = (() => {
    let lastGetWorkspaceAbortController = new AbortController();
    return () => {
      lastGetWorkspaceAbortController.abort();
      return (lastGetWorkspaceAbortController = new AbortController());
    };
  })();

  ipcBridge.conversation.getWorkspace.provider(async ({ workspace, search, path }) => {
    const fileService = GeminiAgent.buildFileServer(workspace);
    try {
      return await readDirectoryRecursive(path, {
        root: workspace,
        fileService,
        abortController: buildLastAbortController(),
        maxDepth: 10, // 支持更深的目录结构 / Support deeper directory structures
        search: {
          text: search,
          onProcess(result) {
            void ipcBridge.conversation.responseSearchWorkSpace.invoke(result);
          },
        },
      }).then((res) => (res ? [res] : []));
    } catch (error) {
      // Catch abort / ENOENT errors to avoid unhandled rejection
      // (bridge provider callbacks have no .catch handler)
      if (error instanceof Error && (error.message.includes('aborted') || error.message.includes('ENOENT'))) {
        return [];
      }
      console.error('[conversationBridge] getWorkspace error:', error);
      return [];
    }
  });

  ipcBridge.conversation.stop.provider(async ({ conversation_id }) => {
    const conversation = await conversationService.getConversation(conversation_id);
    if (conversation?.type === 'group') {
      await groupConversationService.stopConversation(conversation_id);
      return { success: true };
    }

    if (conversation) {
      await contextRuntimeService.recordConversationStopped(conversation, 'user-stop');
      emitConversationInterrupted(conversation);
    }

    const task = workerTaskManager.getTask(conversation_id);
    if (!task) return { success: true, msg: 'conversation not found' };
    await task.stop();
    return { success: true };
  });

  ipcBridge.conversation.getProjectCapabilitySnapshot.provider(async ({ workspacePath }) => {
    const snapshot = await projectCapabilityService.readSnapshot(workspacePath);
    if (!snapshot) {
      return undefined;
    }

    return {
      workspacePath: snapshot.workspacePath,
      automationRootRelativePath: snapshot.automationRootRelativePath,
      counts: { ...snapshot.counts },
      skills: snapshot.skills.map((skill) => ({
        ...skill,
        compatibility: [...skill.compatibility],
      })),
      hooks: snapshot.hooks.map((hook) => ({
        ...hook,
        events: [...hook.events],
        runnableEvents: [...hook.runnableEvents],
        outputTargets: [...hook.outputTargets],
      })),
      commands: snapshot.commands.map((command) => ({ ...command })),
      schedules: snapshot.schedules.map((schedule) => ({ ...schedule })),
    };
  });

  ipcBridge.conversation.getSlashCommands.provider(async ({ conversation_id, includeRuntimeCommands = true }) => {
    try {
      const conversation = await conversationService.getConversation(conversation_id);
      const managedLibrary = await resolveManagedSlashCommandLibrary(conversation, spaceService);
      if (!conversation) {
        return { success: true, data: { commands: [], managedLibrary } };
      }

      if (!includeRuntimeCommands || conversation.type !== 'acp') {
        return { success: true, data: { commands: [], managedLibrary } };
      }

      // Use getTask (cache-only) to avoid spawning a worker process on read-only queries
      const task = workerTaskManager.getTask(conversation_id) as unknown as AcpAgentManager | undefined;
      if (!task || task.type !== 'acp') {
        return { success: true, data: { commands: [], managedLibrary } };
      }

      const commands = await task.loadAcpSlashCommands();
      return { success: true, data: { commands, managedLibrary } };
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 通用 sendMessage 实现 - 统一调用 IAgentManager.sendMessage
  // Generic sendMessage - dispatches via IAgentManager.sendMessage interface
  ipcBridge.conversation.sendMessage.provider(async ({ conversation_id, files, ...other }) => {
    const conversation = await conversationService.getConversation(conversation_id);
    if (!conversation) {
      return { success: false, msg: 'conversation not found' };
    }

    if (conversation?.type === 'group') {
      try {
        await groupConversationService.sendMessage({
          conversationId: conversation_id,
          input: other.input,
          msgId: other.msg_id,
        });
        emitConversationListChanged(conversation, 'updated');
        await refreshTrayMenuSafely();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          msg: err instanceof Error ? err.message : String(err),
        };
      }
    }

    let task: IAgentManager | undefined;
    try {
      task = await workerTaskManager.getOrBuildTask(conversation_id);
    } catch (err) {
      console.error(`[conversationBridge] sendMessage: failed to get/build task: ${conversation_id}`, err);
      return {
        success: false,
        msg: err instanceof Error ? err.message : 'conversation not found',
      };
    }

    if (!task) {
      return { success: false, msg: 'conversation not found' };
    }

    try {
      await assertDesktopCanControl(conversation);
    } catch (error) {
      return {
        success: false,
        msg: error instanceof Error ? error.message : String(error),
      };
    }

    // Copy files to workspace (unified for all agents)
    const workspaceFiles = await copyFilesToDirectory(task.workspace, files, false, getSystemDir().cacheDir);

    const { content: hookInjectedInput, appliedHooks } = await assistantHookRuntime.applyBeforeUserPrompt(
      conversation,
      other.input
    );

    if (appliedHooks.length > 0) {
      console.log(
        `[conversationBridge] Applied before_user_prompt hooks for ${conversation_id}: ${appliedHooks.join(', ')}`
      );
    }

    // Precompute agent content with optional skill injection.
    // OpenClaw uses full-content mode: inject full skill text rather than index paths,
    // because the CLI may not proactively read SKILL.md files the way ACP agents do.
    let agentContent = hookInjectedInput;
    let agentInput = hookInjectedInput;
    if (other.injectSkills?.length) {
      agentContent = await prepareFirstMessage(hookInjectedInput, {
        enabledSkills: other.injectSkills,
      });
      // Provide absolute skills directory so agent can resolve relative script paths
      // e.g. "skills/star-office-helper/scripts/..." → "${skillsDir}/star-office-helper/scripts/..."
      const skillsDir = getSkillsDir();
      const builtinSkillsCopyDir = getBuiltinSkillsCopyDir();
      agentContent = agentContent.replace(
        '[User Request]',
        `[Skills Directory]\nBuiltin skills: ${builtinSkillsCopyDir}\nUser skills: ${skillsDir}\nWhen skill instructions reference relative paths like "skills/{name}/scripts/...", resolve them under the appropriate directory.\n\n[User Request]`
      );
    }

    const preparedTurn = await contextRuntimeService.prepareOutgoingTurn({
      conversation,
      userInput: hookInjectedInput,
      agentInput,
      agentContent,
      msgId: other.msg_id,
    });
    agentInput = preparedTurn.agentInput;
    agentContent = preparedTurn.agentContent;

    try {
      // Pass unified data — each agent reads the fields it needs from the unknown payload.
      // `content` aliases `input` for ACP/Codex/NanoBot/OpenClaw agents.
      // `agentContent` carries the skill-injected text for OpenClaw (equals `input` when no skills).
      await task.sendMessage({
        ...other,
        content: other.input,
        input: other.input,
        files: workspaceFiles,
        agentInput,
        agentContent,
      });
      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        msg: err instanceof Error ? err.message : String(err),
      };
    } finally {
      if (conversation) {
        emitConversationListChanged(conversation, 'updated');
      }
    }
  });

  // 通用 confirmMessage 实现 - 自动根据 conversation 类型分发

  ipcBridge.conversation.confirmation.confirm.provider(async ({ conversation_id, msg_id, data, callId }) => {
    const task = workerTaskManager.getTask(conversation_id);
    if (!task) return { success: false, msg: 'conversation not found' };
    task.confirm(msg_id, callId, data);
    return { success: true };
  });
  ipcBridge.conversation.confirmation.list.provider(async ({ conversation_id }) => {
    const task = workerTaskManager.getTask(conversation_id);
    if (!task) return [];
    return task.getConfirmations();
  });

  // Session-level approval memory for "always allow" decisions
  // 会话级别的权限记忆，用于 "always allow" 决策
  // Keys are parsed from raw action+commandType here (single source of truth)
  // Keys 在此处从原始 action+commandType 解析（单一数据源）
  ipcBridge.conversation.approval.check.provider(async ({ conversation_id, action, commandType }) => {
    const task = workerTaskManager.getTask(conversation_id) as unknown as GeminiAgentManager | undefined;
    if (!task || task.type !== 'gemini' || !task.approvalStore) {
      return false;
    }
    const keys = GeminiApprovalStore.createKeysFromConfirmation(action, commandType);
    if (keys.length === 0) return false;
    return task.approvalStore.allApproved(keys);
  });
}
