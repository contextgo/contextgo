import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import type { HookInfo } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import { getConversationWorkspacePath, getWorkspaceAutomationPaths } from '@/renderer/utils/workspace/workspace';
import { getIncompatibleHookNames } from '@/renderer/pages/settings/AgentSettings/AssistantManagement/assistantUtils';
import { getConversationEnabledHooks, resolveConversationHookBackend } from '../utils/sessionHooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MessageApi } from '../types';

type UseSessionHooksParams = {
  conversation: TChatConversation;
  messageApi: MessageApi;
};

const normalizeHookNames = (value: unknown): string[] => {
  const enabledHooks = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'enabledHooks' in value
      ? (value as { enabledHooks?: unknown }).enabledHooks
      : undefined;

  if (!Array.isArray(enabledHooks)) {
    return [];
  }

  return [
    ...new Set(
      enabledHooks
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    ),
  ];
};

export const useSessionHooks = ({ conversation, messageApi }: UseSessionHooksParams) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [hooksLoading, setHooksLoading] = useState(false);
  const [hooksSaving, setHooksSaving] = useState(false);
  const [availableHooks, setAvailableHooks] = useState<HookInfo[]>([]);
  const [selectedHooks, setSelectedHooks] = useState<string[]>([]);

  const currentBackend = useMemo(() => resolveConversationHookBackend(conversation), [conversation]);
  const workspacePath = useMemo(() => getConversationWorkspacePath(conversation), [conversation]);
  const automationPaths = useMemo(
    () => (workspacePath ? getWorkspaceAutomationPaths(workspacePath) : null),
    [workspacePath]
  );

  const loadSelectedHooks = useCallback(async (): Promise<string[]> => {
    if (!automationPaths) {
      return getConversationEnabledHooks(conversation);
    }

    const raw = await ipcBridge.fs.readFile.invoke({ path: automationPaths.hooksFile });
    if (typeof raw !== 'string') {
      return getConversationEnabledHooks(conversation);
    }

    try {
      return normalizeHookNames(JSON.parse(raw) as unknown);
    } catch (error) {
      console.warn('Failed to parse workspace hook selection:', automationPaths.hooksFile, error);
      return [];
    }
  }, [automationPaths, conversation]);

  const loadHooks = useCallback(async () => {
    setHooksLoading(true);
    try {
      const [hooks, enabledHooks] = await Promise.all([
        workspacePath
          ? ipcBridge.fs.listAvailableHooks.invoke({ workspacePath })
          : ipcBridge.fs.listAvailableHooks.invoke({}),
        loadSelectedHooks(),
      ]);
      setAvailableHooks(hooks);
      setSelectedHooks(enabledHooks);
      return hooks;
    } catch (error) {
      console.error('Failed to load session hooks:', error);
      messageApi.error(t('conversation.workspace.sessionHooksLoadFailed', { defaultValue: 'Failed to load hooks' }));
      setAvailableHooks([]);
      setSelectedHooks(await loadSelectedHooks());
      return [];
    } finally {
      setHooksLoading(false);
    }
  }, [loadSelectedHooks, messageApi, t, workspacePath]);

  useEffect(() => {
    if (visible) {
      void loadHooks();
    }
  }, [loadHooks, visible]);

  const handleSave = useCallback(async () => {
    setHooksSaving(true);
    try {
      const incompatibleHookNames = getIncompatibleHookNames(availableHooks, selectedHooks, currentBackend);
      if (incompatibleHookNames.length > 0) {
        messageApi.error(
          t('settings.hookSaveIncompatible', {
            hooks: incompatibleHookNames.join(', '),
            defaultValue: 'Remove hooks not supported by the selected agent before saving: {{hooks}}',
          })
        );
        return false;
      }

      const normalizedSelection = normalizeHookNames(selectedHooks);

      if (automationPaths) {
        await ipcBridge.fs.writeFile.invoke({
          path: automationPaths.hooksFile,
          data:
            JSON.stringify(
              {
                enabledHooks: normalizedSelection,
              },
              null,
              2
            ) + '\n',
        });
      }

      const mirrorSaved = await ipcBridge.conversation.update.invoke({
        id: conversation.id,
        updates: {
          extra: {
            enabledHooks: normalizedSelection,
          },
        },
        mergeExtra: true,
      });

      if (!automationPaths && !mirrorSaved) {
        messageApi.error(
          t('conversation.workspace.sessionHooksSaveFailed', {
            defaultValue: 'Failed to save session hooks',
          })
        );
        return false;
      }

      if (automationPaths && !mirrorSaved) {
        console.warn('Failed to mirror workspace hook selection into conversation extra:', conversation.id);
      }

      messageApi.success(
        t('conversation.workspace.sessionHooksSaved', {
          defaultValue: 'Session hooks updated',
        })
      );
      setVisible(false);
      return true;
    } catch (error) {
      console.error('Failed to save session hooks:', error);
      messageApi.error(
        t('conversation.workspace.sessionHooksSaveFailed', {
          defaultValue: 'Failed to save session hooks',
        })
      );
      return false;
    } finally {
      setHooksSaving(false);
    }
  }, [automationPaths, availableHooks, conversation.id, currentBackend, messageApi, selectedHooks, t]);

  return {
    visible,
    setVisible,
    hooksLoading,
    hooksSaving,
    availableHooks,
    selectedHooks,
    setSelectedHooks,
    currentBackend,
    loadHooks,
    handleSave,
  };
};
