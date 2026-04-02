/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PendingMessageBar from '@/renderer/components/chat/PendingMessageBar';
import type { PendingConversationMessage } from '@/renderer/pages/conversation/hooks/usePendingConversationMessages';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'conversation.pendingMessages.title') return `待发送 ${options?.count ?? 0}`;
      if (key === 'conversation.pendingMessages.shortcuts') return 'Tab 入队 · Cmd/Ctrl+Enter 引导 · Option/Alt+↑ 取回最近一条';
      if (key === 'conversation.pendingMessages.edit') return '重新编辑';
      if (key === 'conversation.pendingMessages.attachments') return `${options?.count ?? 0} 个文件`;
      if (key === 'conversation.pendingMessages.mode.queue') return '队列';
      if (key === 'conversation.pendingMessages.mode.steer') return '引导';
      if (key === 'conversation.pendingMessages.actions.queue') return '改为队列';
      if (key === 'conversation.pendingMessages.actions.steer') return '改为引导';
      if (key === 'common.delete') return '删除';
      return key;
    },
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, icon, status, type }: any) => (
    <button type='button' data-status={status} data-type={type} onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@icon-park/react', () => ({
  ArrowUp: () => <span>arrow</span>,
  DeleteFive: () => <span>delete</span>,
  EditTwo: () => <span>edit</span>,
}));

const createMessage = (overrides: Partial<PendingConversationMessage> = {}): PendingConversationMessage => ({
  id: overrides.id ?? 'msg-1',
  content: overrides.content ?? '这是一条待发送消息',
  attachments: overrides.attachments ?? [],
  mode: overrides.mode ?? 'queue',
  status: overrides.status ?? 'pending',
  createdAt: overrides.createdAt ?? 1,
});

describe('PendingMessageBar', () => {
  it('renders a compact summary without dispatching state copy', () => {
    render(
      <PendingMessageBar
        messages={[createMessage({ attachments: ['/tmp/a.txt'], status: 'dispatching' })]}
        onRemove={vi.fn()}
        onEdit={vi.fn()}
        onSetMode={vi.fn()}
      />
    );

    expect(screen.getByText('待发送 1')).toBeInTheDocument();
    expect(screen.getByText('Tab 入队 · Cmd/Ctrl+Enter 引导 · Option/Alt+↑ 取回最近一条')).toBeInTheDocument();
    expect(screen.getByText('队列')).toBeInTheDocument();
    expect(screen.getByText('1 个文件')).toBeInTheDocument();
    expect(screen.queryByText('发送中...')).not.toBeInTheDocument();
  });

  it('keeps edit, mode switch, and delete actions available', () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    const onSetMode = vi.fn();

    render(
      <PendingMessageBar
        messages={[createMessage({ mode: 'queue' })]}
        onRemove={onRemove}
        onEdit={onEdit}
        onSetMode={onSetMode}
      />
    );

    fireEvent.click(screen.getByText('重新编辑'));
    fireEvent.click(screen.getByText('改为引导'));
    fireEvent.click(screen.getByText('删除'));

    expect(onEdit).toHaveBeenCalledWith('msg-1');
    expect(onSetMode).toHaveBeenCalledWith('msg-1', 'steer');
    expect(onRemove).toHaveBeenCalledWith('msg-1');
  });
});
