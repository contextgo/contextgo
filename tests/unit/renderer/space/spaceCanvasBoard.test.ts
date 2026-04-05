import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';
import { buildSpaceCanvasBoard, buildSpaceProjectGroups } from '@/renderer/pages/space/utils/spaceCanvasBoard';

const createConversation = (overrides: Partial<TChatConversation>): TChatConversation => {
  return {
    id: 'conversation-1',
    name: 'Untitled',
    type: 'codex',
    createTime: 1,
    modifyTime: 1,
    status: 'finished',
    model: {
      id: 'provider-1',
      platform: 'openai',
      name: 'Provider',
      baseUrl: 'https://example.com',
      apiKey: 'key',
      useModel: 'gpt-4.1',
    },
    extra: {
      spaceId: 'space-1',
      workingDirectory: '/workspace/project-a',
      workspace: '/workspace/project-a',
    },
    ...overrides,
  } as TChatConversation;
};

describe('buildSpaceProjectGroups', () => {
  it('groups space conversations by working directory and sorts projects by latest activity', () => {
    const groups = buildSpaceProjectGroups({
      spaceId: 'space-1',
      conversations: [
        createConversation({
          id: 'conv-a1',
          name: 'Alpha latest',
          modifyTime: 30,
          extra: {
            spaceId: 'space-1',
            workingDirectory: '/workspace/project-a',
            workspace: '/workspace/project-a',
          },
        }),
        createConversation({
          id: 'conv-b1',
          name: 'Beta running',
          modifyTime: 60,
          status: 'running',
          extra: {
            spaceId: 'space-1',
            workingDirectory: '/workspace/project-b',
            workspace: '/workspace/project-b',
          },
        }),
        createConversation({
          id: 'conv-a2',
          name: 'Alpha old',
          modifyTime: 10,
          extra: {
            spaceId: 'space-1',
            workingDirectory: '/workspace/project-a',
            workspace: '/workspace/project-a',
          },
        }),
        createConversation({
          id: 'conv-other-space',
          modifyTime: 100,
          extra: {
            spaceId: 'space-2',
            workingDirectory: '/workspace/project-z',
            workspace: '/workspace/project-z',
          },
        }),
      ],
    });

    expect(groups).toHaveLength(2);
    expect(groups[0]?.title).toBe('project-b');
    expect(groups[0]?.runningCount).toBe(1);
    expect(groups[1]?.title).toBe('project-a');
    expect(groups[1]?.sessions.map((session) => session.id)).toEqual(['conv-a1', 'conv-a2']);
  });

  it('ignores archived conversations and falls back to conversation metadata when no directory exists', () => {
    const groups = buildSpaceProjectGroups({
      spaceId: 'space-1',
      conversations: [
        createConversation({
          id: 'conv-title-fallback',
          name: 'Canvas Planning',
          modifyTime: 42,
          extra: {
            spaceId: 'space-1',
          },
        }),
        createConversation({
          id: 'conv-archived',
          name: 'Archived',
          modifyTime: 99,
          extra: {
            spaceId: 'space-1',
            archived: true,
          },
        }),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]?.title).toBe('Canvas Planning');
    expect(groups[0]?.workingDirectory).toBeUndefined();
  });
});

describe('buildSpaceCanvasBoard', () => {
  it('builds project, session, and summary nodes for the current space', () => {
    const board = buildSpaceCanvasBoard({
      spaceId: 'space-1',
      conversations: [
        createConversation({
          id: 'conv-a1',
          name: 'Alpha task',
          status: 'running',
          modifyTime: 50,
          extra: {
            spaceId: 'space-1',
            workingDirectory: '/workspace/project-a',
            workspace: '/workspace/project-a',
          },
        }),
        createConversation({
          id: 'conv-a2',
          name: 'Alpha review',
          modifyTime: 40,
          extra: {
            spaceId: 'space-1',
            workingDirectory: '/workspace/project-a',
            workspace: '/workspace/project-a',
          },
        }),
      ],
      memoryCount: 3,
      profileCount: 2,
    });

    expect(board.nodes.filter((node) => node.kind === 'project')).toHaveLength(1);
    expect(board.nodes.filter((node) => node.kind === 'session')).toHaveLength(2);
    expect(board.nodes.filter((node) => node.kind === 'memory')).toHaveLength(1);
    expect(board.nodes.filter((node) => node.kind === 'profile')).toHaveLength(1);
    expect(board.edges.some((edge) => edge.kind === 'contains')).toBe(true);
    expect(board.edges.some((edge) => edge.kind === 'feeds')).toBe(true);

    const sessionNode = board.nodes.find((node) => node.kind === 'session' && node.conversationId === 'conv-a1');
    expect(sessionNode).toMatchObject({
      kind: 'session',
      status: 'running',
      backend: 'codex',
    });

    const memoryNode = board.nodes.find((node) => node.kind === 'memory');
    expect(memoryNode).toMatchObject({ count: 3 });
  });

  it('keeps summary nodes even when the space has no linked sessions', () => {
    const board = buildSpaceCanvasBoard({
      spaceId: 'space-1',
      conversations: [
        createConversation({
          id: 'conv-other-space',
          extra: {
            spaceId: 'space-2',
            workingDirectory: '/workspace/project-z',
            workspace: '/workspace/project-z',
          },
        }),
      ],
      memoryCount: 1,
      profileCount: 0,
    });

    expect(board.nodes.filter((node) => node.kind === 'project')).toHaveLength(0);
    expect(board.nodes.filter((node) => node.kind === 'summary')).toHaveLength(0);
    expect(board.nodes.filter((node) => node.kind === 'memory')).toHaveLength(1);
    expect(board.nodes.filter((node) => node.kind === 'profile')).toHaveLength(1);
  });
});
