/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '../../../src/common/config/storage';
import { splitDiscussionChildConversations } from '../../../src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';
import { buildGroupedHistory } from '../../../src/renderer/pages/conversation/GroupedHistory/utils/groupingHelpers';

const createConversation = (id: string, overrides: Partial<TChatConversation> = {}): TChatConversation => ({
  createTime: 1,
  modifyTime: 1,
  name: `Conversation ${id}`,
  id,
  type: 'gemini',
  extra: {
    workspace: '/workspace/project-a',
    customWorkspace: true,
  },
  model: {
    id: 'model-1',
    name: 'Gemini',
    useModel: 'gemini-2.0-flash',
    platform: 'gemini',
    baseUrl: '',
    apiKey: '',
  } as TChatConversation['model'],
  ...overrides,
});

describe('discussion conversation grouping', () => {
  it('treats any conversation with parentGroupId as a discussion child', () => {
    const parentConversation = createConversation('group-1', {
      type: 'group',
      extra: {
        workspace: '/workspace/project-a',
        customWorkspace: true,
        participants: [],
        orchestration: {
          mode: 'broadcast',
          rounds: 1,
        },
      },
    } as Partial<TChatConversation>);
    const childConversation = createConversation('child-1', {
      extra: {
        workspace: '/workspace/project-a',
        customWorkspace: true,
        groupMeta: {
          parentGroupId: 'group-1',
          participantId: 'participant-1',
          participantName: 'Child Agent',
        },
      },
    } as Partial<TChatConversation>);

    const result = splitDiscussionChildConversations([parentConversation, childConversation]);

    expect(result.topLevelConversations.map((conversation) => conversation.id)).toEqual(['group-1']);
    expect(result.discussionChildConversationsByParentId['group-1']?.map((conversation) => conversation.id)).toEqual([
      'child-1',
    ]);
  });

  it('does not render discussion children as top-level history items even if they slip into the conversation list', () => {
    const parentConversation = createConversation('group-1', {
      type: 'group',
      extra: {
        workspace: '/workspace/project-a',
        customWorkspace: true,
        participants: [],
        orchestration: {
          mode: 'broadcast',
          rounds: 1,
        },
      },
    } as Partial<TChatConversation>);
    const childConversation = createConversation('child-1', {
      extra: {
        workspace: '/workspace/project-a',
        customWorkspace: true,
        groupMeta: {
          parentGroupId: 'group-1',
          participantId: 'participant-1',
          participantName: 'Child Agent',
        },
      },
    } as Partial<TChatConversation>);

    const groupedHistory = buildGroupedHistory(
      [parentConversation, childConversation],
      {
        'group-1': [childConversation],
      },
      (key) => key
    );

    const workspaceItems = groupedHistory.timelineSections[0]?.items ?? [];
    const workspaceConversations =
      workspaceItems[0]?.type === 'workspace' && workspaceItems[0].workspaceGroup
        ? workspaceItems[0].workspaceGroup.conversations.map((conversation) => conversation.id)
        : [];

    expect(workspaceConversations).toEqual(['group-1']);
    expect(workspaceItems[0]?.type === 'workspace' ? workspaceItems[0].workspaceGroup?.id : undefined).toBe(
      'working-directory:/workspace/project-a'
    );
    expect(
      groupedHistory.discussionChildConversationsByParentId['group-1']?.map((conversation) => conversation.id)
    ).toEqual(['child-1']);
  });

  it('groups by spaceId before workingDirectory when a logical space is present', () => {
    const spaceConversation = createConversation('space-1', {
      extra: {
        spaceId: 'space-alpha',
        workingDirectory: '/workspace/project-a',
        workspace: '/workspace/project-a',
        customWorkspace: true,
      },
    } as Partial<TChatConversation>);

    const groupedHistory = buildGroupedHistory([spaceConversation], {}, (key) => key);
    const firstItem = groupedHistory.timelineSections[0]?.items[0];

    expect(firstItem?.type).toBe('workspace');
    expect(firstItem?.type === 'workspace' ? firstItem.workspaceGroup?.id : undefined).toBe('space:space-alpha');
  });
});
