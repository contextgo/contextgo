import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IConversationService } from '@/process/services/IConversationService';
import type { IWorkerTaskManager } from '@/process/task/IWorkerTaskManager';

const { conversationResponseEmit, turnCompletedEmit, sendMessageMock, stopStreamingMock, insertMessageMock } =
  vi.hoisted(() => ({
    conversationResponseEmit: vi.fn(),
    turnCompletedEmit: vi.fn(),
    sendMessageMock: vi.fn(),
    stopStreamingMock: vi.fn(),
    insertMessageMock: vi.fn(),
  }));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      responseStream: {
        emit: conversationResponseEmit,
      },
      turnCompleted: {
        emit: turnCompletedEmit,
      },
    },
  },
}));

vi.mock('@process/channels/agent/ChannelMessageService', () => ({
  getChannelMessageService: () => ({
    sendMessage: sendMessageMock,
    stopStreaming: stopStreamingMock,
  }),
}));

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => ({
    insertMessage: insertMessageMock,
  })),
}));

import { DiscussionGroupService } from '@/process/bridge/services/discussion/DiscussionGroupService';

const model = {
  platform: 'openai',
  name: 'Test Model',
  useModel: 'gpt-4.1',
};

type MockCreateConversationParams = {
  type: string;
  id?: string;
  name?: string;
  model: typeof model;
  extra: Record<string, unknown>;
};

describe('DiscussionGroupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates child conversations under the parent group workspace', async () => {
    const createConversation = vi.fn(async (params: MockCreateConversationParams) => {
      if (params.type === 'group') {
        return {
          id: params.id,
          type: 'group',
          name: params.name,
          model: params.model,
          createTime: 1,
          modifyTime: 1,
          extra: {
            workspace: '/tmp/shared-group-workspace',
            customWorkspace: false,
            participants: [],
            orchestration: params.extra.orchestration,
          },
        };
      }

      return {
        id: `${params.name}-child`,
        type: 'acp',
        name: params.name,
        model,
        createTime: 1,
        modifyTime: 1,
        extra: params.extra,
      };
    });

    const updateConversation = vi.fn(async () => {});
    const conversationService = {
      createConversation,
      updateConversation,
      deleteConversation: vi.fn(async () => {}),
    };

    const service = new DiscussionGroupService(
      conversationService as unknown as IConversationService,
      {
        kill: vi.fn(),
      } as unknown as IWorkerTaskManager
    );

    const result = await service.createConversation({
      id: 'group-1',
      type: 'group',
      name: 'Architecture Review',
      model,
      extra: {
        participants: [
          {
            id: 'participant-1',
            participantType: 'cli-agent',
            participantKey: 'codex:/usr/local/bin/codex:Codex',
            name: 'Codex',
            childConversationId: '',
            conversation: {
              type: 'acp',
              name: 'Codex',
              model,
              extra: {
                backend: 'codex',
              },
            },
          },
          {
            id: 'participant-2',
            participantType: 'cli-agent',
            participantKey: 'claude:/usr/local/bin/claude:Claude',
            name: 'Claude',
            childConversationId: '',
            conversation: {
              type: 'acp',
              name: 'Claude',
              model,
              extra: {
                backend: 'claude',
              },
            },
          },
        ],
        orchestration: {
          mode: 'broadcast',
          rounds: 1,
        },
      },
    } as unknown as MockCreateConversationParams);

    expect(createConversation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'group',
        id: 'group-1',
      })
    );
    expect(createConversation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'Codex',
        extra: expect.objectContaining({
          workspace: '/tmp/shared-group-workspace',
          customWorkspace: false,
          groupMeta: expect.objectContaining({
            parentGroupId: 'group-1',
            participantId: 'participant-1',
            hiddenFromHistory: true,
          }),
        }),
      })
    );
    expect(createConversation).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        name: 'Claude',
        extra: expect.objectContaining({
          workspace: '/tmp/shared-group-workspace',
          customWorkspace: false,
          groupMeta: expect.objectContaining({
            parentGroupId: 'group-1',
            participantId: 'participant-2',
            hiddenFromHistory: true,
          }),
        }),
      })
    );
    expect(updateConversation).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({
        extra: expect.objectContaining({
          participants: [
            expect.objectContaining({
              childConversationId: 'Codex-child',
            }),
            expect.objectContaining({
              childConversationId: 'Claude-child',
            }),
          ],
        }),
      })
    );
    expect(result.extra.workspace).toBe('/tmp/shared-group-workspace');
    expect(result.extra.participants).toHaveLength(2);
  });

  it('persists the user message before projecting assistant replies', async () => {
    const conversationService = {
      getConversation: vi.fn(async () => ({
        id: 'group-1',
        type: 'group',
        name: 'Group',
        model,
        createTime: 1,
        modifyTime: 1,
        extra: {
          workspace: '/tmp/shared-group-workspace',
          customWorkspace: false,
          participants: [
            {
              id: 'participant-1',
              participantType: 'cli-agent',
              participantKey: 'codex:/usr/local/bin/codex:Codex',
              name: 'Codex',
              childConversationId: 'child-1',
            },
          ],
          orchestration: {
            mode: 'broadcast',
            rounds: 1,
          },
        },
      })),
      updateConversation: vi.fn(async () => {}),
    };

    sendMessageMock.mockImplementation(
      async (
        _groupId: string,
        _childId: string,
        _prompt: string,
        onChunk: (chunk: {
          id: string;
          msg_id: string;
          type: 'text';
          position: 'left';
          conversation_id: string;
          content: { content: string };
          createdAt: number;
        }) => void
      ) => {
        onChunk({
          id: 'assistant-msg-1',
          msg_id: 'assistant-msg-1',
          type: 'text',
          position: 'left',
          conversation_id: 'child-1',
          content: {
            content: 'Projected reply',
          },
          createdAt: 2,
        });
      }
    );

    const service = new DiscussionGroupService(
      conversationService as unknown as IConversationService,
      {
        kill: vi.fn(),
      } as unknown as IWorkerTaskManager
    );

    await service.sendMessage({
      conversationId: 'group-1',
      input: 'Summarize the rollout plan.',
      msgId: 'user-msg-1',
    });

    expect(insertMessageMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversation_id: 'group-1',
        msg_id: 'user-msg-1',
        position: 'right',
        content: {
          content: 'Summarize the rollout plan.',
        },
      })
    );
    expect(insertMessageMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        conversation_id: 'group-1',
        position: 'left',
        content: expect.objectContaining({
          content: 'Projected reply',
          groupMeta: expect.objectContaining({
            participantId: 'participant-1',
            childConversationId: 'child-1',
          }),
        }),
      })
    );
  });

  it('rejects harness groups that are not bound to a git repository', async () => {
    const conversationService = {
      createConversation: vi.fn(),
      updateConversation: vi.fn(),
      deleteConversation: vi.fn(),
    };

    const service = new DiscussionGroupService(
      conversationService as unknown as IConversationService,
      {
        kill: vi.fn(),
      } as unknown as IWorkerTaskManager
    );

    await expect(
      service.createConversation({
        id: 'group-1',
        type: 'group',
        name: 'Harness Review',
        model,
        extra: {
          workspace: '/tmp/workspace',
          customWorkspace: true,
          participants: [],
          orchestration: {
            mode: 'debate',
            rounds: 2,
          },
          collaboration: {
            mode: 'planner-generator-evaluator',
            executionBoundary: {
              type: 'workspace',
            },
          },
        },
      } as never)
    ).rejects.toThrow('git repository');

    expect(conversationService.createConversation).not.toHaveBeenCalled();
  });
});
