/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingConversationMessages } from '@/renderer/pages/conversation/hooks/usePendingConversationMessages';

const dispatchMock =
  vi.fn<
    (_: {
      id: string;
      content: string;
      attachments: string[];
      mode: 'queue' | 'steer';
      status: 'pending' | 'dispatching';
      createdAt: number;
    }) => Promise<void>
  >();

const Harness: React.FC<{ canSendNow?: boolean }> = ({ canSendNow = true }) => {
  const { pendingMessages, enqueuePendingMessage } = usePendingConversationMessages({
    conversationId: 'conv-dispatch',
    canSendNow,
    canSteerNow: false,
    onDispatch: dispatchMock,
  });

  React.useEffect(() => {
    enqueuePendingMessage('queue', 'hello world', []);
  }, [enqueuePendingMessage]);

  return (
    <div>
      {pendingMessages.map((message) => (
        <div key={message.id}>
          {message.status}:{message.content}
        </div>
      ))}
    </div>
  );
};

describe('usePendingConversationMessages dispatch lifecycle', () => {
  beforeEach(() => {
    dispatchMock.mockReset();
  });

  it('removes dispatched items from the pending list immediately instead of keeping a dispatching ghost row', async () => {
    let resolveDispatch: (() => void) | null = null;
    dispatchMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDispatch = resolve;
        })
    );

    render(<Harness />);

    await waitFor(() => {
      expect(dispatchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByText(/hello world/)).not.toBeInTheDocument();

    resolveDispatch?.();

    await waitFor(() => {
      expect(screen.queryByText(/hello world/)).not.toBeInTheDocument();
    });
  });

  it('restores the item when dispatch fails', async () => {
    dispatchMock.mockRejectedValueOnce(new Error('boom'));

    render(<Harness />);

    await waitFor(() => {
      expect(dispatchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('pending:hello world')).toBeInTheDocument();
    });
  });
});
