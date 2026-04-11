/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';
import { transformMessage } from '@/common/chat/chatLib';
import { readConversationUiState } from '@/renderer/pages/conversation/hooks/conversationUiStateCache';
import { useConversationUiStateRestore } from '@/renderer/pages/conversation/hooks/useConversationUiStateRestore';
import { useAddOrUpdateMessage } from '@/renderer/pages/conversation/Messages/hooks';
import React, { useCallback, useState } from 'react';

const GROUP_UI_STATE_SCOPE = 'group';
const createDefaultGroupUiState = () => ({ running: false });

export const useGroupConversation = (conversationId: string) => {
  const addOrUpdateMessage = useAddOrUpdateMessage();
  const [running, setRunning] = useState(
    readConversationUiState(GROUP_UI_STATE_SCOPE, conversationId, createDefaultGroupUiState()).running
  );

  const handleResponseMessage = useCallback(
    (message: IResponseMessage) => {
      if (message.conversation_id !== conversationId) {
        return;
      }

      if (message.type === 'start') {
        setRunning(true);
        return;
      }

      if (message.type === 'finish') {
        setRunning(false);
        return;
      }

      const transformedMessage = transformMessage(message);
      if (transformedMessage) {
        addOrUpdateMessage(transformedMessage);
      }
    },
    [addOrUpdateMessage, conversationId]
  );

  useConversationUiStateRestore({
    scope: GROUP_UI_STATE_SCOPE,
    conversationId,
    state: { running },
    createDefaultState: createDefaultGroupUiState,
    applyCachedState: (cachedState) => {
      setRunning(cachedState.running);
    },
    syncBackendState: (isRunning) => {
      setRunning(isRunning);
    },
  });

  React.useEffect(() => {
    return ipcBridge.conversation.responseStream.on(handleResponseMessage);
  }, [handleResponseMessage]);

  return {
    running,
    setRunning,
  };
};
