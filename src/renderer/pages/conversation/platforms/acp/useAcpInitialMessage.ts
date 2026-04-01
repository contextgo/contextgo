/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chat/chatLib';
import { uuid } from '@/common/utils';
import { emitter } from '@/renderer/utils/emitter';
import { useEffect } from 'react';
import type { TFunction } from 'i18next';

type UseAcpInitialMessageParams = {
  conversationId: string;
  backend: string;
  setAiProcessing: (value: boolean) => void;
  checkAndUpdateTitle: (conversationId: string, input: string) => void;
  addOrUpdateMessage: (message: TMessage, prepend?: boolean) => void;
  t: TFunction;
};

/**
 * Side-effect-only hook that checks sessionStorage for an initial message
 * and sends it when the ACP conversation first mounts.
 */
export const useAcpInitialMessage = ({
  conversationId,
  backend,
  setAiProcessing,
  checkAndUpdateTitle,
  addOrUpdateMessage,
  t,
}: UseAcpInitialMessageParams): void => {
  useEffect(() => {
    const storageKey = `acp_initial_message_${conversationId}`;
    const storedMessage = sessionStorage.getItem(storageKey);

    if (!storedMessage) return;

    // Clear immediately to prevent duplicate sends (e.g., if component remounts while sendMessage is pending)
    sessionStorage.removeItem(storageKey);

    const sendInitialMessage = async () => {
      const showInitialMessageError = (errorMessage: string) => {
        const message: TMessage = {
          id: uuid(),
          msg_id: uuid(),
          conversation_id: conversationId,
          type: 'tips',
          position: 'center',
          content: {
            content: errorMessage,
            type: 'error',
          },
          createdAt: Date.now() + 2,
        };
        addOrUpdateMessage(message, true);
      };

      try {
        const initialMessage = JSON.parse(storedMessage);
        const { input, files } = initialMessage;

        // ACP: don't use buildDisplayMessage, pass raw input directly
        // File references are added by the backend ACP agent (using actual copied paths)
        // Avoid two inconsistent sets of file references in the message
        const msg_id = uuid();
        const userMessage: TMessage = {
          id: msg_id,
          msg_id,
          conversation_id: conversationId,
          type: 'text',
          position: 'right',
          content: {
            content: input,
          },
          createdAt: Date.now(),
        };

        // Start AI processing loading state (user message will be added via backend response)
        addOrUpdateMessage(userMessage, true);
        setAiProcessing(true);

        // Send the message
        const result = await ipcBridge.acpConversation.sendMessage.invoke({
          input,
          msg_id,
          conversation_id: conversationId,
          files,
        });

        if (result && result.success === true) {
          // Initial message sent successfully
          void checkAndUpdateTitle(conversationId, input);
          emitter.emit('chat.history.refresh');
        } else {
          const resultMessage = result?.msg || t('guid.sendFailed');
          const lowerMessage = resultMessage.toLowerCase();
          console.error('[ACP-FRONTEND] Failed to send initial message:', result);
          showInitialMessageError(
            lowerMessage.includes('auth') || lowerMessage.includes('login') || lowerMessage.includes('api key')
              ? t('acp.auth.failed', {
                  backend,
                  error: resultMessage,
                })
              : t('guid.sendFailedWithReason', {
                  reason: resultMessage,
                  defaultValue: resultMessage,
                })
          );
          setAiProcessing(false); // Stop loading state on failure
        }
      } catch (error) {
        console.error('Error sending initial message:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const lowerMessage = errorMessage.toLowerCase();
        showInitialMessageError(
          lowerMessage.includes('auth') || lowerMessage.includes('login') || lowerMessage.includes('api key')
            ? t('acp.auth.failed', {
                backend,
                error: errorMessage,
              })
            : t('guid.sendFailedWithReason', {
                reason: errorMessage,
                defaultValue: errorMessage,
              })
        );
        setAiProcessing(false); // Stop loading state on error
      }
    };

    sendInitialMessage().catch((error) => {
      console.error('Failed to send initial message:', error);
    });
  }, [conversationId, backend, addOrUpdateMessage, checkAndUpdateTitle, setAiProcessing, t]);
};
