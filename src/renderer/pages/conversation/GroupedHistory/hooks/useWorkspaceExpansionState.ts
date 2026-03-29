import { useEffect, useState } from 'react';

export const WORKSPACE_EXPANSION_STORAGE_KEY = 'aionui_workspace_expansion';
export const WORKSPACE_EXPANSION_EVENT = 'aionui:workspace-expansion-changed';
export const DISCUSSION_GROUP_EXPANSION_STORAGE_KEY = 'aionui_discussion_group_expansion';
export const DISCUSSION_GROUP_EXPANSION_EVENT = 'aionui:discussion-group-expansion-changed';

type WorkspaceExpansionChangeDetail = {
  expandedWorkspaces: string[];
};

type DiscussionGroupExpansionChangeDetail = {
  expandedDiscussionGroups: string[];
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

export const readExpandedDiscussionGroups = (): string[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(DISCUSSION_GROUP_EXPANSION_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const dispatchDiscussionGroupExpansionChange = (expandedDiscussionGroups: string[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<DiscussionGroupExpansionChangeDetail>(DISCUSSION_GROUP_EXPANSION_EVENT, {
      detail: { expandedDiscussionGroups },
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

export const useDiscussionGroupExpansionState = (): string[] => {
  const [expandedDiscussionGroups, setExpandedDiscussionGroups] = useState<string[]>(() =>
    readExpandedDiscussionGroups()
  );

  useEffect(() => {
    const handleDiscussionGroupExpansionChange = (event: Event) => {
      const customEvent = event as CustomEvent<DiscussionGroupExpansionChangeDetail>;
      setExpandedDiscussionGroups(customEvent.detail?.expandedDiscussionGroups ?? readExpandedDiscussionGroups());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === DISCUSSION_GROUP_EXPANSION_STORAGE_KEY) {
        setExpandedDiscussionGroups(readExpandedDiscussionGroups());
      }
    };

    window.addEventListener(DISCUSSION_GROUP_EXPANSION_EVENT, handleDiscussionGroupExpansionChange as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(
        DISCUSSION_GROUP_EXPANSION_EVENT,
        handleDiscussionGroupExpansionChange as EventListener
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return expandedDiscussionGroups;
};
