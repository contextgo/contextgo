/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';

const { getInvoke, updateInvoke } = vi.hoisted(() => {
  return {
    getInvoke: vi.fn(),
    updateInvoke: vi.fn(),
  };
});

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      get: {
        invoke: getInvoke,
      },
      update: {
        invoke: updateInvoke,
      },
    },
  },
}));

import {
  isDiscussionFamilyConversation,
  syncDiscussionFamilyWorkspace,
} from '@/renderer/pages/conversation/utils/discussionGroupWorkspace';

const createGroupConversation = (): Extract<TChatConversation, { type: 'group' }> =>
  ({
    id: 'group-1',
    type: 'group',
    name: 'Group 1',
    createTime: 1,
    modifyTime: 1,
    model: { provider: 'openai', model: 'gpt-4.1' },
    extra: {
      workspace: '/tmp/group-1',
      customWorkspace: false,
      participants: [
        {
          id: 'participant-1',
          participantType: 'cli-agent',
          participantKey: 'codex',
          name: 'Codex',
          childConversationId: 'child-1',
        },
        {
          id: 'participant-2',
          participantType: 'cli-agent',
          participantKey: 'claude',
          name: 'Claude Code',
          childConversationId: 'child-2',
        },
      ],
      orchestration: {
        mode: 'debate',
        rounds: 2,
      },
    },
  }) as Extract<TChatConversation, { type: 'group' }>;

const createChildConversation = (id: string): TChatConversation =>
  ({
    id,
    type: 'codex',
    name: id,
    createTime: 1,
    modifyTime: 1,
    model: { provider: 'openai', model: 'gpt-4.1' },
    extra: {
      workspace: '/tmp/group-1',
      customWorkspace: false,
      groupMeta: {
        parentGroupId: 'group-1',
        participantId: `participant-${id}`,
        participantName: id,
        hiddenFromHistory: true,
      },
    },
  }) as TChatConversation;

describe('discussionGroupWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateInvoke.mockResolvedValue(true);
  });

  it('detects both group parents and group children as discussion family conversations', () => {
    const groupConversation = createGroupConversation();
    const childConversation = createChildConversation('child-1');
    const normalConversation = {
      ...createChildConversation('standalone'),
      extra: {
        workspace: '/tmp/standalone',
        customWorkspace: false,
      },
    } as TChatConversation;

    expect(isDiscussionFamilyConversation(groupConversation)).toBe(true);
    expect(isDiscussionFamilyConversation(childConversation)).toBe(true);
    expect(isDiscussionFamilyConversation(normalConversation)).toBe(false);
  });

  it('updates parent and child sessions in place when migrating a group conversation workspace', async () => {
    const groupConversation = createGroupConversation();
    const childConversation1 = createChildConversation('child-1');
    const childConversation2 = createChildConversation('child-2');

    getInvoke.mockImplementation(async ({ id }: { id: string }) => {
      if (id === 'child-1') return childConversation1;
      if (id === 'child-2') return childConversation2;
      return null;
    });

    const updatedConversations = await syncDiscussionFamilyWorkspace(groupConversation, '/Users/bytedance/project/demo');

    expect(updatedConversations.map((conversation) => conversation.id)).toEqual(['group-1', 'child-1', 'child-2']);
    expect(updateInvoke).toHaveBeenCalledTimes(3);
    expect(updateInvoke).toHaveBeenNthCalledWith(1, {
      id: 'group-1',
      updates: {
        extra: {
          workspace: '/Users/bytedance/project/demo',
          customWorkspace: true,
        },
      },
      mergeExtra: true,
    });
    expect(updateInvoke).toHaveBeenNthCalledWith(2, {
      id: 'child-1',
      updates: {
        extra: {
          workspace: '/Users/bytedance/project/demo',
          customWorkspace: true,
        },
      },
      mergeExtra: true,
    });
    expect(updateInvoke).toHaveBeenNthCalledWith(3, {
      id: 'child-2',
      updates: {
        extra: {
          workspace: '/Users/bytedance/project/demo',
          customWorkspace: true,
        },
      },
      mergeExtra: true,
    });
  });

  it('resolves the parent group and updates the whole family when triggered from a child session', async () => {
    const groupConversation = createGroupConversation();
    const childConversation1 = createChildConversation('child-1');
    const childConversation2 = createChildConversation('child-2');

    getInvoke.mockImplementation(async ({ id }: { id: string }) => {
      if (id === 'group-1') return groupConversation;
      if (id === 'child-1') return childConversation1;
      if (id === 'child-2') return childConversation2;
      return null;
    });

    const updatedConversations = await syncDiscussionFamilyWorkspace(childConversation1, '/Users/bytedance/project/demo');

    expect(getInvoke).toHaveBeenCalledWith({ id: 'group-1' });
    expect(updatedConversations.map((conversation) => conversation.id)).toEqual(['group-1', 'child-1', 'child-2']);
    expect(updateInvoke).toHaveBeenCalledTimes(3);
  });
});
