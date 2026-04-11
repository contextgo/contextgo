/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation, TProviderWithModel } from '@/common/config/storage';
import { emitter } from '@/renderer/utils/emitter';
import { buildDisplayMessage } from '@/renderer/utils/file/messageFiles';
import { updateWorkspaceTime } from '@/renderer/utils/workspace/workspaceHistory';
import { Message } from '@arco-design/web-react';
import { useCallback } from 'react';
import type { TFunction } from 'i18next';
import type { NavigateFunction } from 'react-router-dom';
import type { AcpBackend, AvailableAgent } from '../types';

export type GuidSendDeps = {
  // Input state
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  files: string[];
  setFiles: React.Dispatch<React.SetStateAction<string[]>>;
  dir: string;
  setDir: React.Dispatch<React.SetStateAction<string>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;

  // Agent state
  selectedAgent: AcpBackend | 'custom';
  selectedAgentKey: string;
  selectedAgentInfo: AvailableAgent | undefined;
  selectedAssistantInfo: AvailableAgent | undefined;
  selectedMode: string;
  selectedAcpModel: string | null;
  currentModel: TProviderWithModel | undefined;

  // Agent helpers
  findAgentByKey: (key: string) => AvailableAgent | undefined;
  resolvePresetRulesAndSkills: (
    agentInfo: { backend: AcpBackend; customAgentId?: string; openclawAgentId?: string; context?: string } | undefined
  ) => Promise<{ rules?: string; skills?: string }>;
  resolveEnabledSkills: (
    agentInfo: { backend: AcpBackend; customAgentId?: string; openclawAgentId?: string } | undefined
  ) => string[] | undefined;
  resolveEnabledHooks: (
    agentInfo: { backend: AcpBackend; customAgentId?: string; openclawAgentId?: string } | undefined
  ) => string[] | undefined;
  isGoogleAuth: boolean;

  // Mention state reset
  setMentionOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMentionQuery: React.Dispatch<React.SetStateAction<string | null>>;
  setMentionSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setMentionActiveIndex: React.Dispatch<React.SetStateAction<number>>;

  // Navigation & tabs
  navigate: NavigateFunction;
  closeAllTabs: () => void;
  openTab: (conversation: TChatConversation) => void;
  selectedSpaceId?: string | null;
  t: TFunction;
};

export type GuidSendResult = {
  handleSend: () => Promise<void>;
  sendMessageHandler: () => void;
  isButtonDisabled: boolean;
};

/**
 * Hook that manages the send logic for all conversation types (gemini/openclaw/nanobot/acp).
 */
export const useGuidSend = (deps: GuidSendDeps): GuidSendResult => {
  const {
    input,
    setInput,
    files,
    setFiles,
    dir,
    setDir,
    setLoading,
    selectedAgent,
    selectedAgentKey,
    selectedAgentInfo,
    selectedAssistantInfo,
    selectedMode,
    selectedAcpModel,
    currentModel,
    findAgentByKey,
    resolvePresetRulesAndSkills,
    resolveEnabledSkills,
    resolveEnabledHooks,
    isGoogleAuth,
    setMentionOpen,
    setMentionQuery,
    setMentionSelectorOpen,
    setMentionActiveIndex,
    navigate,
    closeAllTabs,
    openTab,
    selectedSpaceId,
    t,
  } = deps;

  const handleSend = useCallback(async () => {
    const isCustomWorkspace = !!dir;
    const finalWorkspace = dir || '';
    const runtimeAgentInfo = selectedAgentInfo || findAgentByKey(selectedAgentKey);
    const presetAssistantInfo = selectedAssistantInfo?.isPreset ? selectedAssistantInfo : undefined;
    const isPresetAssistant = Boolean(presetAssistantInfo);

    const { rules: presetRules } = isPresetAssistant ? await resolvePresetRulesAndSkills(presetAssistantInfo) : {};
    const enabledSkills = isPresetAssistant ? resolveEnabledSkills(presetAssistantInfo) : undefined;
    const enabledHooks = isPresetAssistant ? resolveEnabledHooks(presetAssistantInfo) : undefined;
    const presetAssistantId = isPresetAssistant ? presetAssistantInfo?.customAgentId : undefined;

    // Gemini path
    if (selectedAgent === 'gemini') {
      const placeholderModel = currentModel || {
        id: 'gemini-placeholder',
        name: 'Gemini',
        useModel: 'default',
        platform: 'gemini-with-google-auth' as const,
        baseUrl: '',
        apiKey: '',
      };
      try {
        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'gemini',
          name: input,
          model: placeholderModel,
          extra: {
            defaultFiles: files,
            workspace: finalWorkspace,
            customWorkspace: isCustomWorkspace,
            webSearchEngine:
              placeholderModel.platform === 'gemini-with-google-auth' ||
              placeholderModel.platform === 'gemini-vertex-ai'
                ? 'google'
                : 'default',
            presetRules,
            enabledSkills,
            enabledHooks,
            presetAssistantId,
            spaceId: selectedSpaceId ?? undefined,
            sessionMode: selectedMode,
          },
        });

        if (!conversation || !conversation.id) {
          throw new Error('Failed to create conversation - conversation object is null or missing id');
        }

        if (isCustomWorkspace) {
          closeAllTabs();
          updateWorkspaceTime(finalWorkspace);
          openTab(conversation);
        }

        emitter.emit('chat.history.refresh');

        const workspacePath = conversation.extra?.workspace || '';
        const displayMessage = buildDisplayMessage(input, files, workspacePath);
        const initialMessage = {
          input: displayMessage,
          files: files.length > 0 ? files : undefined,
        };
        sessionStorage.setItem(`gemini_initial_message_${conversation.id}`, JSON.stringify(initialMessage));

        ipcBridge.conversation.warmup.invoke({ conversation_id: conversation.id }).catch(() => {});
        void navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        console.error('Failed to create Gemini conversation:', error);
        throw error;
      }
      return;
    }

    // OpenClaw Gateway path
    if (selectedAgent === 'openclaw-gateway') {
      const openclawRuntimeInfo = runtimeAgentInfo || findAgentByKey(selectedAgentKey);
      const openclawWorkspace = openclawRuntimeInfo?.workspace || finalWorkspace;
      const openclawUsesFixedWorkspace = Boolean(openclawRuntimeInfo?.workspace);

      try {
        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'openclaw-gateway',
          name: input,
          model: currentModel!,
          extra: {
            defaultFiles: files,
            workspace: openclawWorkspace,
            customWorkspace: isCustomWorkspace || openclawUsesFixedWorkspace,
            backend: openclawRuntimeInfo?.backend,
            cliPath: openclawRuntimeInfo?.cliPath,
            agentName: openclawRuntimeInfo?.name,
            openclawAgentId: openclawRuntimeInfo?.openclawAgentId,
            runtimeValidation: {
              expectedWorkspace: openclawWorkspace,
              expectedBackend: openclawRuntimeInfo?.backend,
              expectedAgentName: openclawRuntimeInfo?.name,
              expectedOpenClawAgentId: openclawRuntimeInfo?.openclawAgentId,
              expectedCliPath: openclawRuntimeInfo?.cliPath,
              expectedModel: currentModel?.useModel,
              switchedAt: Date.now(),
            },
            enabledSkills,
            enabledHooks,
            presetAssistantId,
            spaceId: selectedSpaceId ?? undefined,
          },
        });

        if (!conversation || !conversation.id) {
          alert('Failed to create OpenClaw conversation. Please ensure the OpenClaw Gateway is running.');
          return;
        }

        if (isCustomWorkspace) {
          closeAllTabs();
          updateWorkspaceTime(finalWorkspace);
          openTab(conversation);
        }

        emitter.emit('chat.history.refresh');

        const initialMessage = {
          input,
          files: files.length > 0 ? files : undefined,
        };
        sessionStorage.setItem(`openclaw_initial_message_${conversation.id}`, JSON.stringify(initialMessage));

        ipcBridge.conversation.warmup.invoke({ conversation_id: conversation.id }).catch(() => {});
        await navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(`Failed to create OpenClaw conversation: ${errorMessage}`);
        throw error;
      }
      return;
    }

    // Nanobot path
    if (selectedAgent === 'nanobot') {
      try {
        const conversation = await ipcBridge.conversation.create.invoke({
          type: 'nanobot',
          name: input,
          model: currentModel!,
          extra: {
            defaultFiles: files,
            workspace: finalWorkspace,
            customWorkspace: isCustomWorkspace,
            enabledSkills,
            enabledHooks,
            presetAssistantId,
            spaceId: selectedSpaceId ?? undefined,
          },
        });

        if (!conversation || !conversation.id) {
          alert('Failed to create Nanobot conversation. Please ensure nanobot is installed.');
          return;
        }

        if (isCustomWorkspace) {
          closeAllTabs();
          updateWorkspaceTime(finalWorkspace);
          openTab(conversation);
        }

        emitter.emit('chat.history.refresh');

        const initialMessage = {
          input,
          files: files.length > 0 ? files : undefined,
        };
        sessionStorage.setItem(`nanobot_initial_message_${conversation.id}`, JSON.stringify(initialMessage));

        ipcBridge.conversation.warmup.invoke({ conversation_id: conversation.id }).catch(() => {});
        await navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        alert(`Failed to create Nanobot conversation: ${errorMessage}`);
        throw error;
      }
      return;
    }

    // ACP path
    const acpRuntimeInfo = runtimeAgentInfo || findAgentByKey(selectedAgentKey);
    const acpBackend = (acpRuntimeInfo?.backend || selectedAgent) as import('@/common/types/acpTypes').AcpBackendAll;

    if (!acpRuntimeInfo && selectedAgent !== 'custom') {
      console.warn(`${selectedAgent} runtime info not found, but proceeding to let conversation panel handle it.`);
    }

    try {
      if (acpBackend === 'codex') {
        const health = await ipcBridge.acpConversation.checkAgentHealth.invoke({ backend: 'codex' });
        if (!health?.success || health.data?.available === false) {
          const errorMessage = health?.data?.error || health?.msg || t('guid.sendFailed');
          const lowerMessage = errorMessage.toLowerCase();
          Message.error(
            lowerMessage.includes('auth') || lowerMessage.includes('login') || lowerMessage.includes('api key')
              ? t('acp.auth.failed', {
                  backend: 'codex',
                  error: errorMessage,
                })
              : t('guid.sendFailedWithReason', {
                  reason: errorMessage,
                  defaultValue: errorMessage,
                })
          );
          return;
        }
      }

      const conversation = await ipcBridge.conversation.create.invoke({
        type: 'acp',
        name: input,
        model: currentModel!,
        extra: {
          defaultFiles: files,
          workspace: finalWorkspace,
          customWorkspace: isCustomWorkspace,
          backend: acpBackend,
          cliPath: acpRuntimeInfo?.cliPath,
          agentName: acpRuntimeInfo?.name,
          customAgentId: acpRuntimeInfo?.customAgentId,
          presetContext: presetRules,
          enabledSkills,
          enabledHooks,
          presetAssistantId,
          spaceId: selectedSpaceId ?? undefined,
          sessionMode: selectedMode,
          currentModelId: selectedAcpModel || undefined,
        },
      });

      if (!conversation || !conversation.id) {
        console.error('Failed to create ACP conversation - conversation object is null or missing id');
        return;
      }

      if (isCustomWorkspace) {
        closeAllTabs();
        updateWorkspaceTime(finalWorkspace);
        openTab(conversation);
      }

      emitter.emit('chat.history.refresh');

      const initialMessage = {
        input,
        files: files.length > 0 ? files : undefined,
      };
      sessionStorage.setItem(`acp_initial_message_${conversation.id}`, JSON.stringify(initialMessage));

      ipcBridge.conversation.warmup.invoke({ conversation_id: conversation.id }).catch(() => {});
      await navigate(`/conversation/${conversation.id}`);
    } catch (error: unknown) {
      console.error('Failed to create ACP conversation:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Message.error(
        t('guid.sendFailedWithReason', {
          reason: errorMessage,
          defaultValue: errorMessage,
        })
      );
      throw error;
    }
  }, [
    input,
    files,
    dir,
    selectedAgent,
    selectedAgentKey,
    selectedAgentInfo,
    selectedAssistantInfo,
    selectedMode,
    selectedAcpModel,
    currentModel,
    findAgentByKey,
    resolvePresetRulesAndSkills,
    resolveEnabledSkills,
    resolveEnabledHooks,
    navigate,
    closeAllTabs,
    openTab,
    selectedSpaceId,
    t,
  ]);

  const sendMessageHandler = useCallback(() => {
    setLoading(true);
    handleSend()
      .then(() => {
        setInput('');
        setMentionOpen(false);
        setMentionQuery(null);
        setMentionSelectorOpen(false);
        setMentionActiveIndex(0);
        setFiles([]);
        setDir('');
      })
      .catch((error) => {
        console.error('Failed to send message:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    handleSend,
    setLoading,
    setInput,
    setMentionOpen,
    setMentionQuery,
    setMentionSelectorOpen,
    setMentionActiveIndex,
    setFiles,
    setDir,
  ]);

  const isButtonDisabled = !input.trim() || (selectedAgent === 'gemini' && !currentModel && isGoogleAuth);

  return {
    handleSend,
    sendMessageHandler,
    isButtonDisabled,
  };
};
