/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '../../../src/common/config/storage';
import type { TimelineSection, WorkspaceGroup } from '../../../src/renderer/pages/conversation/GroupedHistory/types';
import { buildVisibleConversationIds } from '../../../src/renderer/pages/conversation/GroupedHistory/utils/visibleConversationOrder';

const createConversation = (id: string): TChatConversation => ({
  createTime: 1,
  modifyTime: 1,
  name: `Conversation ${id}`,
  id,
  type: 'gemini',
  extra: {
    workspace: `/workspace/${id}`,
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
});

const createWorkspaceGroup = (workspace: string, conversationIds: string[]): WorkspaceGroup => ({
  workspace,
  displayName: workspace,
  conversations: conversationIds.map((conversationId) => createConversation(conversationId)),
});

describe('buildVisibleConversationIds', () => {
  it('keeps pinned conversations first and preserves rendered section order', () => {
    const timelineSections: TimelineSection[] = [
      {
        timeline: 'Today',
        items: [
          {
            type: 'conversation',
            time: 3,
            conversation: createConversation('direct-1'),
          },
          {
            type: 'workspace',
            time: 2,
            workspaceGroup: createWorkspaceGroup('/workspace/project-a', ['ws-1', 'ws-2']),
          },
          {
            type: 'conversation',
            time: 1,
            conversation: createConversation('direct-2'),
          },
        ],
      },
    ];

    const visibleConversationIds = buildVisibleConversationIds({
      pinnedConversations: [createConversation('pinned-1'), createConversation('pinned-2')],
      timelineSections,
      groupChildConversationsByParentId: {},
      expandedWorkspaces: ['/workspace/project-a'],
      expandedGroupConversations: [],
      siderCollapsed: false,
    });

    expect(visibleConversationIds).toEqual(['pinned-1', 'pinned-2', 'direct-1', 'ws-1', 'ws-2', 'direct-2']);
  });

  it('skips conversations inside collapsed workspace groups', () => {
    const visibleConversationIds = buildVisibleConversationIds({
      pinnedConversations: [],
      timelineSections: [
        {
          timeline: 'Today',
          items: [
            {
              type: 'workspace',
              time: 1,
              workspaceGroup: createWorkspaceGroup('/workspace/project-a', ['ws-1', 'ws-2']),
            },
          ],
        },
      ],
      groupChildConversationsByParentId: {},
      expandedWorkspaces: [],
      expandedGroupConversations: [],
      siderCollapsed: false,
    });

    expect(visibleConversationIds).toEqual([]);
  });

  it('includes workspace conversations when the sidebar is collapsed', () => {
    const visibleConversationIds = buildVisibleConversationIds({
      pinnedConversations: [],
      timelineSections: [
        {
          timeline: 'Today',
          items: [
            {
              type: 'workspace',
              time: 1,
              workspaceGroup: createWorkspaceGroup('/workspace/project-a', ['ws-1', 'ws-2']),
            },
          ],
        },
      ],
      groupChildConversationsByParentId: {},
      expandedWorkspaces: [],
      expandedGroupConversations: [],
      siderCollapsed: true,
    });

    expect(visibleConversationIds).toEqual(['ws-1', 'ws-2']);
  });

  it('renders group child sessions immediately after their parent conversation', () => {
    const groupConversation = {
      ...createConversation('group-1'),
      type: 'group' as const,
      extra: {
        workspace: '/workspace/group',
        customWorkspace: true,
        participants: [],
        orchestration: {
          kind: 'discussion',
          mode: 'broadcast' as const,
          rounds: 1 as const,
        },
      },
    };

    const visibleConversationIds = buildVisibleConversationIds({
      pinnedConversations: [],
      timelineSections: [
        {
          timeline: 'Today',
          items: [
            {
              type: 'conversation',
              time: 2,
              conversation: groupConversation,
            },
            {
              type: 'conversation',
              time: 1,
              conversation: createConversation('direct-1'),
            },
          ],
        },
      ],
      groupChildConversationsByParentId: {
        'group-1': [createConversation('child-1'), createConversation('child-2')],
      },
      expandedWorkspaces: [],
      expandedGroupConversations: ['group-1'],
      siderCollapsed: false,
    });

    expect(visibleConversationIds).toEqual(['group-1', 'child-1', 'child-2', 'direct-1']);
  });

  it('hides group child sessions until their parent group is expanded', () => {
    const groupConversation = {
      ...createConversation('group-1'),
      type: 'group' as const,
      extra: {
        workspace: '/workspace/group',
        customWorkspace: true,
        participants: [],
        orchestration: {
          kind: 'discussion',
          mode: 'broadcast' as const,
          rounds: 1 as const,
        },
      },
    };

    const visibleConversationIds = buildVisibleConversationIds({
      pinnedConversations: [],
      timelineSections: [
        {
          timeline: 'Today',
          items: [
            {
              type: 'conversation',
              time: 2,
              conversation: groupConversation,
            },
          ],
        },
      ],
      groupChildConversationsByParentId: {
        'group-1': [createConversation('child-1'), createConversation('child-2')],
      },
      expandedWorkspaces: [],
      expandedGroupConversations: [],
      siderCollapsed: false,
    });

    expect(visibleConversationIds).toEqual(['group-1']);
  });

  it('keeps group children nested under their parent inside a workspace section', () => {
    const groupConversation = {
      ...createConversation('group-1'),
      type: 'group' as const,
      extra: {
        workspace: '/workspace/project-a',
        customWorkspace: true,
        participants: [],
        orchestration: {
          kind: 'discussion',
          mode: 'broadcast' as const,
          rounds: 1 as const,
        },
      },
    };

    const workspaceGroup: WorkspaceGroup = {
      workspace: '/workspace/project-a',
      displayName: 'project-a',
      conversations: [groupConversation, createConversation('direct-1')],
    };

    const visibleConversationIds = buildVisibleConversationIds({
      pinnedConversations: [],
      timelineSections: [
        {
          timeline: 'Today',
          items: [
            {
              type: 'workspace',
              time: 1,
              workspaceGroup,
            },
          ],
        },
      ],
      groupChildConversationsByParentId: {
        'group-1': [createConversation('child-1'), createConversation('child-2')],
      },
      expandedWorkspaces: ['/workspace/project-a'],
      expandedGroupConversations: ['group-1'],
      siderCollapsed: false,
    });

    expect(visibleConversationIds).toEqual(['group-1', 'child-1', 'child-2', 'direct-1']);
  });
});
