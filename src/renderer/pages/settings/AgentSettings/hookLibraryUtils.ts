import {
  HOOK_CATEGORIES,
  supportsHookOutputRouting,
  type HookCategory,
  type HookOutputBaseDir,
  type HookOutputRoutingConfig,
  type HookOutputTarget,
} from '@/common/types/hookTypes';
import type { HookInfo } from './AssistantManagement/types';

export const HOOK_OUTPUT_TARGET_PRESENTATION: Record<
  HookOutputTarget,
  {
    color: 'arcoblue' | 'green' | 'purple';
    i18nKey: string;
    defaultLabel: string;
  }
> = {
  'chat-message': {
    color: 'arcoblue',
    i18nKey: 'settings.hookOutputTargets.chatMessage',
    defaultLabel: 'Chat Message',
  },
  'system-notification': {
    color: 'green',
    i18nKey: 'settings.hookOutputTargets.systemNotification',
    defaultLabel: 'Desktop Notification',
  },
  'sidecar-file': {
    color: 'purple',
    i18nKey: 'settings.hookOutputTargets.sidecarFile',
    defaultLabel: 'Sidecar File',
  },
};

export const HOOK_OUTPUT_BASE_DIR_PRESENTATION: Record<
  HookOutputBaseDir,
  {
    i18nKey: string;
    defaultLabel: string;
  }
> = {
  'system-workdir': {
    i18nKey: 'settings.hookOutputBaseDirs.systemWorkdir',
    defaultLabel: 'System Workdir',
  },
  'conversation-workspace': {
    i18nKey: 'settings.hookOutputBaseDirs.conversationWorkspace',
    defaultLabel: 'Conversation Workspace',
  },
};

export type HookOutputRoutingDraft = {
  outputTargets: HookOutputTarget[];
  notificationTitle: string;
  notificationBody: string;
  outputBaseDir: HookOutputBaseDir;
  relativeDir: string;
  fileBaseName: string;
};

export const canConfigureHookOutputRouting = (hook: Pick<HookInfo, 'isCustom' | 'executionType'>): boolean => {
  return hook.isCustom && supportsHookOutputRouting(hook);
};

export const createHookOutputRoutingDraft = (
  hook: Pick<HookInfo, 'outputTargets' | 'notification' | 'outputFile'>
): HookOutputRoutingDraft => {
  return {
    outputTargets: [...(hook.outputTargets || [])],
    notificationTitle: hook.notification?.title || '',
    notificationBody: hook.notification?.body || '',
    outputBaseDir: hook.outputFile?.baseDir || 'system-workdir',
    relativeDir: hook.outputFile?.relativeDir || '',
    fileBaseName: hook.outputFile?.fileBaseName || '',
  };
};

export const buildHookOutputRoutingConfig = (draft: HookOutputRoutingDraft): HookOutputRoutingConfig => {
  const title = draft.notificationTitle.trim();
  const body = draft.notificationBody.trim();
  const relativeDir = draft.relativeDir.trim();
  const fileBaseName = draft.fileBaseName.trim();
  const includesNotification = draft.outputTargets.includes('system-notification');
  const includesSidecarFile = draft.outputTargets.includes('sidecar-file');

  return {
    outputTargets: [...draft.outputTargets],
    notification:
      includesNotification || title || body ? { title: title || undefined, body: body || undefined } : undefined,
    outputFile:
      includesSidecarFile || relativeDir || fileBaseName
        ? {
            baseDir: draft.outputBaseDir,
            relativeDir: relativeDir || undefined,
            fileBaseName: fileBaseName || undefined,
          }
        : undefined,
  };
};

export const filterHooksByQuery = (hooks: HookInfo[], query: string): HookInfo[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return hooks;
  }

  return hooks.filter((hook) => {
    const searchableParts = [
      hook.name,
      hook.description || '',
      hook.location,
      hook.category || '',
      ...(hook.tags || []),
      ...(hook.events || []),
      ...(hook.runnableEvents || []),
      ...(hook.outputTargets || []),
      ...(hook.supportedBackends || []),
    ];
    return searchableParts.some((part) => part.toLowerCase().includes(normalizedQuery));
  });
};

export const getAvailableHookCategories = (hooks: HookInfo[]): HookCategory[] => {
  const presentCategories = new Set(
    hooks
      .map((hook) => hook.category)
      .filter((category): category is HookCategory => Boolean(category && HOOK_CATEGORIES.includes(category)))
  );

  return HOOK_CATEGORIES.filter((category) => presentCategories.has(category));
};

export const filterHooksByCategory = (hooks: HookInfo[], category: HookCategory | 'all'): HookInfo[] => {
  if (category === 'all') {
    return hooks;
  }

  return hooks.filter((hook) => hook.category === category);
};

export const summarizeHookLibrary = (hooks: HookInfo[]) => {
  const customCount = hooks.filter((hook) => hook.isCustom).length;
  const readyNowCount = hooks.filter((hook) => (hook.runnableEvents || []).length > 0).length;
  return {
    total: hooks.length,
    custom: customCount,
    builtin: hooks.length - customCount,
    readyNow: readyNowCount,
  };
};
