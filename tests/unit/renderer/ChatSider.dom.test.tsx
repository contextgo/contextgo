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

  it('renders the workspace panel for discussion groups', () => {
    render(
      <ChatSider
        conversation={{
          id: 'group-1',
          type: 'group',
          name: 'Discussion Group',
          model: {
            platform: 'openai',
            name: 'Test Model',
            useModel: 'gpt-4.1',
          },
          createTime: 1,
          modifyTime: 1,
          extra: {
            workspace: '/tmp/discussion-workspace',
            customWorkspace: false,
            participants: [],
            orchestration: {
              mode: 'broadcast',
              rounds: 1,
            },
          },
        }}
      />
    );

    expect(screen.getByTestId('chat-workspace')).toHaveTextContent('group-1:/tmp/discussion-workspace:group');
    expect(chatWorkspaceMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        conversation_id: 'group-1',
        workspace: '/tmp/discussion-workspace',
        eventPrefix: 'group',
      })
    );
  });

  it('renders the workspace panel for OpenClaw conversations', () => {
    render(
      <ChatSider
        conversation={{
          id: 'openclaw-1',
          type: 'openclaw-gateway',
          name: 'OpenClaw Session',
          model: {
            platform: 'openai',
            name: 'Test Model',
            useModel: 'gpt-5',
          },
          createTime: 1,
          modifyTime: 1,
          extra: {
            workspace: '/tmp/openclaw-workspace',
            customWorkspace: false,
            backend: 'openclaw-gateway',
          },
        }}
      />
    );

    expect(screen.getByTestId('chat-workspace')).toHaveTextContent(
      'openclaw-1:/tmp/openclaw-workspace:openclaw-gateway'
    );
    expect(chatWorkspaceMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        conversation_id: 'openclaw-1',
        workspace: '/tmp/openclaw-workspace',
        eventPrefix: 'openclaw-gateway',
      })
    );
  });
});
