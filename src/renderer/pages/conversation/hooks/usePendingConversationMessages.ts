import { uuid } from '@/common/utils';
import { useLatestRef } from '@/renderer/hooks/ui/useLatestRef';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import useSWR from 'swr';

export type PendingConversationMessageMode = 'queue' | 'steer';
export type PendingConversationMessageStatus = 'pending' | 'dispatching';

export type PendingConversationMessage = {
  id: string;
  content: string;
  attachments: string[];
  mode: PendingConversationMessageMode;
  status: PendingConversationMessageStatus;
  createdAt: number;
};

type PendingConversationMessageStore = Map<string, PendingConversationMessage[]>;

const store: PendingConversationMessageStore = new Map();

const getPendingMessages = (conversationId: string): PendingConversationMessage[] => store.get(conversationId) || [];

const setPendingMessages = (conversationId: string, messages: PendingConversationMessage[]): void => {
  if (messages.length === 0) {
    store.delete(conversationId);
    return;
  }
  store.set(conversationId, messages);
};

export type PendingMessageDispatchState = {
  canSendNow: boolean;
  canSteerNow: boolean;
};

export function selectPendingMessageForDispatch(
  messages: PendingConversationMessage[],
  state: PendingMessageDispatchState
): PendingConversationMessage | null {
  const pendingMessages = messages
    .filter((message) => message.status === 'pending')
    .toSorted((left, right) => left.createdAt - right.createdAt);

  if (pendingMessages.length === 0) {
    return null;
  }

  if (state.canSendNow) {
    return pendingMessages[0] || null;
  }

  if (state.canSteerNow) {
    return pendingMessages.find((message) => message.mode === 'steer') || null;
  }

  return null;
}

const updateMessageList = (
  list: PendingConversationMessage[],
  messageId: string,
  updater: (message: PendingConversationMessage) => PendingConversationMessage | null
): PendingConversationMessage[] => {
  const nextList: PendingConversationMessage[] = [];
  for (const message of list) {
    if (message.id !== messageId) {
      nextList.push(message);
      continue;
    }

    const updatedMessage = updater(message);
    if (updatedMessage) {
      nextList.push(updatedMessage);
    }
  }
  return nextList;
};

type UsePendingConversationMessagesOptions = {
  conversationId: string;
  canSendNow: boolean;
  canSteerNow?: boolean;
  onDispatch: (message: PendingConversationMessage) => Promise<void>;
  onDispatchError?: (error: unknown, message: PendingConversationMessage) => void;
  sendDispatchDelayMs?: number;
};

export function usePendingConversationMessages(options: UsePendingConversationMessagesOptions) {
  const {
    conversationId,
    canSendNow,
    canSteerNow = false,
    onDispatch,
    onDispatchError,
    sendDispatchDelayMs = 0,
  } = options;
  const { data, mutate } = useSWR([`/conversation/pending-messages/${conversationId}`, conversationId], ([, id]) =>
    getPendingMessages(id)
  );

  const pendingMessages = data || [];
  const onDispatchRef = useLatestRef(onDispatch);
  const onDispatchErrorRef = useLatestRef(onDispatchError);
  const dispatchingMessageIdRef = useRef<string | null>(null);
  const dispatchDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delayedSendDispatchRef = useRef<{ messageId: string; readyAt: number } | null>(null);
  const [dispatchTick, bumpDispatchTick] = useReducer((value: number) => value + 1, 0);

  const clearDispatchDelay = useCallback(() => {
    if (dispatchDelayTimerRef.current) {
      clearTimeout(dispatchDelayTimerRef.current);
      dispatchDelayTimerRef.current = null;
    }
    delayedSendDispatchRef.current = null;
  }, []);

  const mutatePendingMessages = useCallback(
    (updater: (messages: PendingConversationMessage[]) => PendingConversationMessage[]) => {
      mutate(
        (previousMessages) => {
          const nextMessages = updater(previousMessages || []);
          setPendingMessages(conversationId, nextMessages);
          return nextMessages;
        },
        { revalidate: false }
      ).catch((error) => {
        console.error('[usePendingConversationMessages] Failed to update pending messages:', error);
      });
    },
    [conversationId, mutate]
  );

  const enqueuePendingMessage = useCallback(
    (mode: PendingConversationMessageMode, content: string, attachments: string[] = []) => {
      const nextMessage: PendingConversationMessage = {
        id: uuid(),
        content,
        attachments,
        mode,
        status: 'pending',
        createdAt: Date.now(),
      };

      mutatePendingMessages((messages) => [...messages, nextMessage]);

      return nextMessage;
    },
    [mutatePendingMessages]
  );

  const removePendingMessage = useCallback(
    (messageId: string) => {
      mutatePendingMessages((messages) => messages.filter((message) => message.id !== messageId));
    },
    [mutatePendingMessages]
  );

  const setPendingMessageMode = useCallback(
    (messageId: string, mode: PendingConversationMessageMode) => {
      mutatePendingMessages((messages) =>
        updateMessageList(messages, messageId, (message) => ({
          ...message,
          mode,
        }))
      );
    },
    [mutatePendingMessages]
  );

  const restorePendingMessage = useCallback(
    (messageId: string) => {
      const message = pendingMessages.find((item) => item.id === messageId);
      if (!message) {
        return null;
      }

      removePendingMessage(messageId);
      return message;
    },
    [pendingMessages, removePendingMessage]
  );

  const restoreLatestPendingMessage = useCallback(() => {
    const latestMessage = [...pendingMessages]
      .filter((message) => message.status === 'pending')
      .toSorted((left, right) => right.createdAt - left.createdAt)[0];

    if (!latestMessage) {
      return null;
    }

    removePendingMessage(latestMessage.id);
    return latestMessage;
  }, [pendingMessages, removePendingMessage]);

  useEffect(() => clearDispatchDelay, [clearDispatchDelay]);

  useEffect(() => {
    if (dispatchingMessageIdRef.current) {
      clearDispatchDelay();
      return;
    }

    const nextPendingMessage = selectPendingMessageForDispatch(pendingMessages, {
      canSendNow,
      canSteerNow,
    });

    if (!nextPendingMessage) {
      clearDispatchDelay();
      return;
    }

    if (canSendNow && sendDispatchDelayMs > 0) {
      const now = Date.now();
      const activeDelay = delayedSendDispatchRef.current;

      if (!activeDelay || activeDelay.messageId !== nextPendingMessage.id) {
        delayedSendDispatchRef.current = {
          messageId: nextPendingMessage.id,
          readyAt: now + sendDispatchDelayMs,
        };
      }

      const readyAt = delayedSendDispatchRef.current?.readyAt ?? now;
      const remainingMs = readyAt - now;

      if (remainingMs > 0) {
        if (dispatchDelayTimerRef.current) {
          clearTimeout(dispatchDelayTimerRef.current);
        }
        dispatchDelayTimerRef.current = setTimeout(() => {
          dispatchDelayTimerRef.current = null;
          bumpDispatchTick();
        }, remainingMs);
        return;
      }
    }

    clearDispatchDelay();
    dispatchingMessageIdRef.current = nextPendingMessage.id;
    mutatePendingMessages((messages) => messages.filter((message) => message.id !== nextPendingMessage.id));

    void onDispatchRef
      .current(nextPendingMessage)
      .then(() => {
        dispatchingMessageIdRef.current = null;
        bumpDispatchTick();
      })
      .catch((error) => {
        onDispatchErrorRef.current?.(error, nextPendingMessage);
        mutatePendingMessages((messages) => [
          ...messages,
          {
            ...nextPendingMessage,
            status: 'pending',
          },
        ]);
        setTimeout(() => {
          dispatchingMessageIdRef.current = null;
        }, 0);
      });
  }, [
    canSendNow,
    canSteerNow,
    dispatchTick,
    mutatePendingMessages,
    onDispatchErrorRef,
    onDispatchRef,
    pendingMessages,
    sendDispatchDelayMs,
    clearDispatchDelay,
  ]);

  return {
    pendingMessages,
    enqueuePendingMessage,
    removePendingMessage,
    setPendingMessageMode,
    restorePendingMessage,
    restoreLatestPendingMessage,
  };
}
