import { ipcBridge } from '@/common';
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

  useEffect(() => {
    writeConversationUiState(scope, conversationId, state);
  }, [conversationId, scope, state]);

  useEffect(() => {
    const hasCachedState = hasConversationUiState(scope, conversationId);
    const cachedState = readConversationUiState(scope, conversationId, createDefaultState());
    applyCachedState(cachedState);
    resetTransientState?.();

    if (!syncBackendState) {
      return;
    }

    void ipcBridge.conversation.get.invoke({ id: conversationId }).then((conversation) => {
      syncBackendState(conversation?.status === 'running', hasCachedState);
    });
  }, [applyCachedState, conversationId, createDefaultState, resetTransientState, scope, syncBackendState]);
};
