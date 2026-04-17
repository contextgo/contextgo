import { ipcBridge } from '@/common';
import { useLatestRef } from '@/renderer/hooks/ui/useLatestRef';
import { hasConversationUiState, readConversationUiState, writeConversationUiState } from './conversationUiStateCache';
import { useEffect } from 'react';

type UseConversationUiStateRestoreOptions<TState> = {
  scope: string;
  conversationId: string;
  state: TState;
  createDefaultState: () => TState;
  applyCachedState: (state: TState) => void;
  resetTransientState?: () => void;
  syncBackendState?: (isRunning: boolean, hasCachedState: boolean) => void;
};

export const useConversationUiStateRestore = <TState>(options: UseConversationUiStateRestoreOptions<TState>): void => {
  const { scope, conversationId, state, createDefaultState, applyCachedState, resetTransientState, syncBackendState } =
    options;
  const createDefaultStateRef = useLatestRef(createDefaultState);
  const applyCachedStateRef = useLatestRef(applyCachedState);
  const resetTransientStateRef = useLatestRef(resetTransientState);
  const syncBackendStateRef = useLatestRef(syncBackendState);

  useEffect(() => {
    writeConversationUiState(scope, conversationId, state);
  }, [conversationId, scope, state]);

  useEffect(() => {
    const hasCachedState = hasConversationUiState(scope, conversationId);
    const cachedState = readConversationUiState(scope, conversationId, createDefaultStateRef.current());
    applyCachedStateRef.current(cachedState);
    resetTransientStateRef.current?.();

    if (!syncBackendStateRef.current) {
      return;
    }

    void ipcBridge.conversation.get.invoke({ id: conversationId }).then((conversation) => {
      syncBackendStateRef.current?.(conversation?.status === 'running', hasCachedState);
    });
  }, [conversationId, scope]);
};
