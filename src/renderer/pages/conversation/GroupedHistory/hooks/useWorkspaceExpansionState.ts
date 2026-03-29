import { useEffect, useState } from 'react';

export const WORKSPACE_EXPANSION_STORAGE_KEY = 'contextgo_workspace_expansion';
export const WORKSPACE_EXPANSION_EVENT = 'contextgo:workspace-expansion-changed';
export const GROUP_CONVERSATION_EXPANSION_STORAGE_KEY = 'contextgo_group_conversation_expansion';
export const GROUP_CONVERSATION_EXPANSION_EVENT = 'contextgo:group-conversation-expansion-changed';

type WorkspaceExpansionChangeDetail = {
  expandedWorkspaces: string[];
};

type GroupConversationExpansionChangeDetail = {
  expandedGroupConversations: string[];
};

export const readExpandedWorkspaces = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(WORKSPACE_EXPANSION_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const dispatchWorkspaceExpansionChange = (expandedWorkspaces: string[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<WorkspaceExpansionChangeDetail>(WORKSPACE_EXPANSION_EVENT, {
      detail: { expandedWorkspaces },
    })
  );
};

export const readExpandedGroupConversations = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(GROUP_CONVERSATION_EXPANSION_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const dispatchGroupConversationExpansionChange = (expandedGroupConversations: string[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<GroupConversationExpansionChangeDetail>(GROUP_CONVERSATION_EXPANSION_EVENT, {
      detail: { expandedGroupConversations },
    })
  );
};

export const useWorkspaceExpansionState = (): string[] => {
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<string[]>(() => readExpandedWorkspaces());

  useEffect(() => {
    const handleWorkspaceExpansionChange = (event: Event) => {
      const customEvent = event as CustomEvent<WorkspaceExpansionChangeDetail>;
      setExpandedWorkspaces(customEvent.detail?.expandedWorkspaces ?? readExpandedWorkspaces());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === WORKSPACE_EXPANSION_STORAGE_KEY) {
        setExpandedWorkspaces(readExpandedWorkspaces());
      }
    };

    window.addEventListener(WORKSPACE_EXPANSION_EVENT, handleWorkspaceExpansionChange as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(WORKSPACE_EXPANSION_EVENT, handleWorkspaceExpansionChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return expandedWorkspaces;
};

export const useGroupConversationExpansionState = (): string[] => {
  const [expandedGroupConversations, setExpandedGroupConversations] = useState<string[]>(() =>
    readExpandedGroupConversations()
  );

  useEffect(() => {
    const handleGroupConversationExpansionChange = (event: Event) => {
      const customEvent = event as CustomEvent<GroupConversationExpansionChangeDetail>;
      setExpandedGroupConversations(customEvent.detail?.expandedGroupConversations ?? readExpandedGroupConversations());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === GROUP_CONVERSATION_EXPANSION_STORAGE_KEY) {
        setExpandedGroupConversations(readExpandedGroupConversations());
      }
    };

    window.addEventListener(GROUP_CONVERSATION_EXPANSION_EVENT, handleGroupConversationExpansionChange as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(
        GROUP_CONVERSATION_EXPANSION_EVENT,
        handleGroupConversationExpansionChange as EventListener
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return expandedGroupConversations;
};
