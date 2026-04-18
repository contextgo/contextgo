/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { IMessageCommandEvent } from '../../../../src/common/chat/chatLib';
import MessageCommandEvent from '../../../../src/renderer/pages/conversation/Messages/components/MessageCommandEvent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; scope?: string }) => {
      if (key === 'conversation.workspace.automation.commandEvent.listDescription') {
        return `count:${options?.count ?? 0};scope:${options?.scope ?? ''}`;
      }
      return key;
    },
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@icon-park/react', () => ({
  Command: () => <span>command</span>,
}));

const createCommandMessage = (content: IMessageCommandEvent['content']): IMessageCommandEvent => ({
  id: 'msg-1',
  msg_id: 'msg-1',
  type: 'command_event',
  position: 'left',
  conversation_id: 'conv-1',
  content,
});

describe('MessageCommandEvent', () => {
  it('renders a created command as a product card', () => {
    render(
      <MessageCommandEvent
        message={createCommandMessage({
          source: 'assistant-skill',
          action: 'create',
          scope: 'project',
          command: {
            id: 'cmd-1',
            enabled: true,
            name: 'review',
            description: 'Review the current diff.',
            template: 'Review the current changes like a strict reviewer.',
          },
        })}
      />
    );

    expect(screen.getByText('conversation.workspace.automation.commandEvent.createTitle')).toBeInTheDocument();
    expect(screen.getByText('/review')).toBeInTheDocument();
    expect(screen.getByText('Review the current diff.')).toBeInTheDocument();
    expect(screen.getByText('Review the current changes like a strict reviewer.')).toBeInTheDocument();
    expect(screen.getByText('conversation.workspace.automation.commandEvent.scope.project')).toBeInTheDocument();
  });

  it('renders deleted commands and error states', () => {
    const { rerender } = render(
      <MessageCommandEvent
        message={createCommandMessage({
          source: 'assistant-skill',
          action: 'delete',
          scope: 'space',
          commandName: 'review',
        })}
      />
    );

    expect(screen.getByText('conversation.workspace.automation.commandEvent.deleteTitle')).toBeInTheDocument();
    expect(screen.getByText('/review')).toBeInTheDocument();
    expect(screen.getByText('conversation.workspace.automation.commandEvent.scope.space')).toBeInTheDocument();

    rerender(
      <MessageCommandEvent
        message={createCommandMessage({
          source: 'assistant-skill',
          action: 'error',
          scope: 'project',
          error: 'Project workspace is unavailable',
        })}
      />
    );

    expect(screen.getByText('conversation.workspace.automation.commandEvent.errorTitle')).toBeInTheDocument();
    expect(screen.getByText('Project workspace is unavailable')).toBeInTheDocument();
  });

  it('renders list results without markdown noise', () => {
    render(
      <MessageCommandEvent
        message={createCommandMessage({
          source: 'assistant-skill',
          action: 'list',
          scope: 'project',
          commands: [
            {
              id: 'cmd-1',
              enabled: true,
              name: 'plan',
              description: 'Plan first',
              template: 'Write the plan first.',
            },
          ],
        })}
      />
    );

    expect(screen.getByText('conversation.workspace.automation.commandEvent.listTitle')).toBeInTheDocument();
    expect(screen.getByText('count:1;scope:project')).toBeInTheDocument();
    expect(screen.getByText('/plan')).toBeInTheDocument();
  });
});
