import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type WorkspaceMockProps = {
  conversation_id: string;
  workspace: string;
  eventPrefix?: string;
};

const chatWorkspaceMock = vi.fn((props: WorkspaceMockProps) => (
  <div data-testid='chat-workspace'>
    {props.conversation_id}:{props.workspace}:{props.eventPrefix}
  </div>
));

vi.mock('@arco-design/web-react', () => ({
  Message: {
    useMessage: () => [{}, null],
  },
}));

vi.mock('../../../src/renderer/pages/conversation/Workspace', () => ({
  default: (props: WorkspaceMockProps) => chatWorkspaceMock(props),
}));

import ChatSider from '../../../src/renderer/pages/conversation/components/ChatSider';

describe('ChatSider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the workspace panel for group conversations', () => {
    render(
      <ChatSider
        conversation={{
          id: 'group-1',
          type: 'group',
          name: 'Group',
          model: {
            platform: 'openai',
            name: 'Test Model',
            useModel: 'gpt-4.1',
          },
          createTime: 1,
          modifyTime: 1,
          extra: {
            workspace: '/tmp/group-workspace',
            customWorkspace: false,
            participants: [],
            orchestration: {
              kind: 'discussion',
              mode: 'broadcast',
              rounds: 1,
            },
          },
        }}
      />
    );

    expect(screen.getByTestId('chat-workspace')).toHaveTextContent('group-1:/tmp/group-workspace:group');
    expect(chatWorkspaceMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        conversation_id: 'group-1',
        workspace: '/tmp/group-workspace',
        eventPrefix: 'group',
      })
    );
  });

  it('renders the workspace panel for ACP conversations', () => {
    render(
      <ChatSider
        conversation={{
          id: 'acp-1',
          type: 'acp',
          name: 'Claude Session',
          model: {
            platform: 'openai',
            name: 'Test Model',
            useModel: 'gpt-5',
          },
          createTime: 1,
          modifyTime: 1,
          extra: {
            workspace: '/tmp/acp-workspace',
            customWorkspace: false,
            backend: 'claude',
          },
        }}
      />
    );

    expect(screen.getByTestId('chat-workspace')).toHaveTextContent('acp-1:/tmp/acp-workspace:acp');
    expect(chatWorkspaceMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        conversation_id: 'acp-1',
        workspace: '/tmp/acp-workspace',
        eventPrefix: 'acp',
      })
    );
  });
});
