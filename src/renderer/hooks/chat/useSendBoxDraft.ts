import type { TChatConversation } from '@/common/config/storage';
import { useCallback, useSyncExternalStore } from 'react';
import type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';
export type { FileOrFolderItem } from '@/renderer/utils/file/fileTypes';

type Draft =
  | {
      _type: 'gemini';
      content: string;
      atPath: Array<string | FileOrFolderItem>;
      uploadFile: string[];
    }
  | {
      _type: 'claude';
      content: unknown;
    }
  | {
      _type: 'acp';
      content: string;
      atPath: Array<string | FileOrFolderItem>;
      uploadFile: string[];
    }
  | {
      _type: 'codex';
      content: string;
      atPath: Array<string | FileOrFolderItem>;
      uploadFile: string[];
    }
  | {
      _type: 'group';
      content: string;
      atPath: Array<string | FileOrFolderItem>;
      uploadFile: string[];
    };

/**
 * 当前支持的对话类型以及对应的草稿对象
 */
type SendBoxDraftStore = {
  [K in TChatConversation['type']]: Map<string, Extract<Draft, { _type: K }>>;
};

const store: SendBoxDraftStore = {
  gemini: new Map(),
  acp: new Map(),
  codex: new Map(),
  group: new Map(),
};

const listeners = new Set<() => void>();

const subscribeDraftStore = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notifyDraftStoreChanged = () => {
  listeners.forEach((listener) => listener());
};

const setDraft = <K extends TChatConversation['type']>(
  type: K,
  conversation_id: string,
  draft: Extract<Draft, { _type: K }> | undefined
) => {
  // TODO import ts-pattern for exhaustive check
  switch (type) {
    case 'gemini':
      if (draft) {
        store.gemini.set(conversation_id, draft as Extract<Draft, { _type: 'gemini' }>);
      } else {
        store.gemini.delete(conversation_id);
      }
      break;
    case 'acp':
      if (draft) {
        store.acp.set(conversation_id, draft as Extract<Draft, { _type: 'acp' }>);
      } else {
        store.acp.delete(conversation_id);
      }
      break;
    case 'codex':
      if (draft) {
        store.codex.set(conversation_id, draft as Extract<Draft, { _type: 'codex' }>);
      } else {
        store.codex.delete(conversation_id);
      }
      break;
    case 'group':
      if (draft) {
        store.group.set(conversation_id, draft as Extract<Draft, { _type: 'group' }>);
      } else {
        store.group.delete(conversation_id);
      }
      break;
    default:
      break;
  }

  notifyDraftStoreChanged();
};

const getDraft = <K extends TChatConversation['type']>(
  type: K,
  conversation_id: string
): Extract<Draft, { _type: K }> | undefined => {
  // TODO import ts-pattern for exhaustive check
  switch (type) {
    case 'gemini':
      return store.gemini.get(conversation_id) as Extract<Draft, { _type: K }>;
    case 'acp':
      return store.acp.get(conversation_id) as Extract<Draft, { _type: K }>;
    case 'codex':
      return store.codex.get(conversation_id) as Extract<Draft, { _type: K }>;
    case 'group':
      return store.group.get(conversation_id) as Extract<Draft, { _type: K }>;
    default:
      return undefined;
  }
};

/**
 * 获得一种类型下的会话草稿操作的 React Hook
 */
export const getSendBoxDraftHook = <K extends TChatConversation['type']>(
  type: K,
  initialValue: Extract<Draft, { _type: K }>
) => {
  function useDraft(conversation_id: string) {
    const data = useSyncExternalStore(
      subscribeDraftStore,
      () => getDraft(type, conversation_id),
      () => getDraft(type, conversation_id)
    );

    const mutateDraft = useCallback(
      (draft: (k: Extract<Draft, { _type: K }>) => typeof k | undefined): void => {
        const currentDraft = getDraft(type, conversation_id) ?? initialValue;
        const nextDraft = draft(currentDraft);
        setDraft(type, conversation_id, nextDraft);
      },
      [conversation_id]
    );

    return {
      data,
      mutate: mutateDraft,
    };
  }

  return useDraft;
};

/**
 * 查询某个对话是否存在草稿
 */
export const useHasDraft = (conversation_id: string) => {
  const data = useSyncExternalStore(
    subscribeDraftStore,
    () => Object.values(store).some((draftMap) => draftMap.has(conversation_id)),
    () => Object.values(store).some((draftMap) => draftMap.has(conversation_id))
  );

  return data;
};

/**
 * 删除某个对话的草稿
 */
export const useDeleteDraft = () => {
  return useCallback(async ({ conversation_id }: { conversation_id: string }) => {
    for (const draftMap of Object.values(store)) {
      if (!draftMap.has(conversation_id)) {
        continue;
      }

      const deleted = draftMap.delete(conversation_id);
      if (deleted) {
        notifyDraftStoreChanged();
      }
      return deleted;
    }

    return false;
  }, []);
};
