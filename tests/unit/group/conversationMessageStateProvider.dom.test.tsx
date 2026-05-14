import type { TMessage } from '@/common/chat/chatLib';
import { render, screen, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getConversationMessagesInvoke = vi.fn();

vi.mock('@/common', () => ({
  ipcBridge: {
    database: {
      getConversationMessages: {
        invoke: (...args: unknown[]) => getConversationMessagesInvoke(...args),
      },
    },
  },
}));

import {
  ConversationMessageStateProvider,
  useAddOrUpdateMessage,
  useMessageList,
} from '@/renderer/pages/conversation/Messages/hooks';

const conversationId = 'conversation-cache-1';

const initialDbMessages: TMessage[] = [
  {
    id: 'db-1',
    msg_id: 'db-1',
    conversation_id: conversationId,
    type: 'text',
    position: 'left',
    content: { content: 'db message' },
    createdAt: 1,
  } as TMessage,
];

const liveMessage: TMessage = {
  id: 'live-1',
  msg_id: 'live-1',
  conversation_id: conversationId,
  type: 'text',
  position: 'left',
  content: { content: 'live message' },
  createdAt: 2,
} as TMessage;

const MessageSnapshot: React.FC = () => {
  const list = useMessageList();
  return <div data-testid='message-count'>{list.length}</div>;
};

const MessageSeeder: React.FC<{ message: TMessage }> = ({ message }) => {
  const addOrUpdateMessage = useAddOrUpdateMessage();

  useEffect(() => {
    addOrUpdateMessage(message, true);
  }, [addOrUpdateMessage, message]);

  return null;
};

describe('ConversationMessageStateProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConversationMessagesInvoke.mockResolvedValue(initialDbMessages);
  });

  it('hydrates cached messages immediately before database refresh completes', async () => {
    const firstRender = render(
      <ConversationMessageStateProvider conversationId={conversationId}>
        <MessageSeeder message={liveMessage} />
        <MessageSnapshot />
      </ConversationMessageStateProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('message-count')).toHaveTextContent('2');
    });

    firstRender.unmount();

    let resolveDbRefresh: ((messages: TMessage[]) => void) | null = null;
    getConversationMessagesInvoke.mockImplementationOnce(
      () =>
        new Promise<TMessage[]>((resolve) => {
          resolveDbRefresh = resolve;
        })
    );

    render(
      <ConversationMessageStateProvider conversationId={conversationId}>
        <MessageSnapshot />
      </ConversationMessageStateProvider>
    );

    expect(screen.getByTestId('message-count')).toHaveTextContent('2');

    resolveDbRefresh?.(initialDbMessages);

    await waitFor(() => {
      expect(screen.getByTestId('message-count')).toHaveTextContent('2');
    });
  });
});
