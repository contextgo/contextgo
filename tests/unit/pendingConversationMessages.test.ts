import { describe, expect, it } from 'vitest';

import {
  selectPendingMessageForDispatch,
  type PendingConversationMessage,
} from '@/renderer/pages/conversation/hooks/usePendingConversationMessages';

const createPendingMessage = (
  id: string,
  mode: PendingConversationMessage['mode'],
  createdAt: number,
  status: PendingConversationMessage['status'] = 'pending'
): PendingConversationMessage => ({
  id,
  content: `message-${id}`,
  attachments: [],
  mode,
  status,
  createdAt,
});

describe('selectPendingMessageForDispatch', () => {
  it('returns the oldest pending message when the conversation is idle', () => {
    const messages = [createPendingMessage('newer', 'steer', 20), createPendingMessage('oldest', 'queue', 10)];

    const nextMessage = selectPendingMessageForDispatch(messages, {
      canSendNow: true,
      canSteerNow: false,
    });

    expect(nextMessage?.id).toBe('oldest');
  });

  it('returns the oldest steer message when only steer dispatch is available', () => {
    const messages = [
      createPendingMessage('queue', 'queue', 5),
      createPendingMessage('steer-late', 'steer', 30),
      createPendingMessage('steer-early', 'steer', 10),
    ];

    const nextMessage = selectPendingMessageForDispatch(messages, {
      canSendNow: false,
      canSteerNow: true,
    });

    expect(nextMessage?.id).toBe('steer-early');
  });

  it('ignores dispatching items and returns null when nothing is eligible', () => {
    const messages = [
      createPendingMessage('dispatching', 'steer', 10, 'dispatching'),
      createPendingMessage('queue', 'queue', 20),
    ];

    const nextMessage = selectPendingMessageForDispatch(messages, {
      canSendNow: false,
      canSteerNow: true,
    });

    expect(nextMessage).toBeNull();
  });
});
