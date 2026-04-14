/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { TChatConversation } from '../../../src/common/config/storage';
import { splitGroupChildConversations } from '../../../src/renderer/pages/conversation/GroupedHistory/hooks/useConversationListSync';
import {
  buildGroupedHistory,
  buildGuidLocationStateFromWorkspaceGroup,
} from '../../../src/renderer/pages/conversation/GroupedHistory/utils/groupingHelpers';

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

describe('group conversation grouping', () => {
  it('treats any conversation with parentGroupId as a group child', () => {
    const parentConversation = createConversation('group-1', {
      type: 'group',
      extra: {
        workspace: '/workspace/project-a',
        customWorkspace: true,
        participants: [],
        orchestration: {
          kind: 'discussion',
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

    const result = splitGroupChildConversations([parentConversation, childConversation]);

    expect(result.topLevelConversations.map((conversation) => conversation.id)).toEqual(['group-1']);
    expect(result.groupChildConversationsByParentId['group-1']?.map((conversation) => conversation.id)).toEqual([
      'child-1',
    ]);
  });

  it('does not render group children as top-level history items even if they slip into the conversation list', () => {
    const parentConversation = createConversation('group-1', {
      type: 'group',
      extra: {
        workspace: '/workspace/project-a',
        customWorkspace: true,
        participants: [],
        orchestration: {
          kind: 'discussion',
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
    expect(groupedHistory.groupChildConversationsByParentId['group-1']?.map((conversation) => conversation.id)).toEqual(
      ['child-1']
    );
  });

  it('falls back to the workspace basename for ACP workspace labels', () => {
    const acpConversation = createConversation('acp-1', {
      type: 'acp',
      extra: {
        backend: 'claude',
        workspace: '/Users/bytedance/project-main',
        customWorkspace: true,
        agentName: 'Claude Main',
      },
      model: {} as TChatConversation['model'],
    } as Partial<TChatConversation>);

    const groupedHistory = buildGroupedHistory([acpConversation], {}, (key) => key);
    const workspaceItem = groupedHistory.timelineSections[0]?.items[0];

    expect(workspaceItem?.type).toBe('workspace');
    expect(workspaceItem?.workspaceGroup?.displayName).toBe('project-main');
    expect(workspaceItem?.workspaceGroup?.workspace).toBe('/Users/bytedance/project-main');
  });

  it('builds guid defaults from the latest workspace conversation', () => {
    const codexConversation = createConversation('codex-1', {
      type: 'codex',
      modifyTime: 10,
      extra: {
        workspace: '/workspace/project-a',
        customWorkspace: true,
        presetAssistantId: 'builtin-superpowers',
        sessionMode: 'yolo',
        codexModel: 'codex-latest',
      },
      model: {} as TChatConversation['model'],
    } as Partial<TChatConversation>);
    const olderGeminiConversation = createConversation('gemini-1', {
      modifyTime: 1,
    });

    const groupedHistory = buildGroupedHistory([olderGeminiConversation, codexConversation], {}, (key) => key);
    const workspaceGroup = groupedHistory.timelineSections[0]?.items[0]?.workspaceGroup;

    expect(workspaceGroup).toBeDefined();
    expect(buildGuidLocationStateFromWorkspaceGroup(workspaceGroup!)).toEqual({
      workspace: '/workspace/project-a',
      preferredAgentKey: 'codex',
      preferredAssistantKey: 'custom:builtin-superpowers',
      preferredMode: 'yolo',
      preferredAcpModelId: 'codex-latest',
    });
  });

  it('groups auto-created temporary workspaces even when customWorkspace is false', () => {
    const tempConversation = createConversation('temp-1', {
      type: 'acp',
      extra: {
        backend: 'codex',
        workspace: '/Users/bytedance/.contextgo-dev/codex-temp-1776134552686',
        workingDirectory: '/Users/bytedance/.contextgo-dev/codex-temp-1776134552686',
        customWorkspace: false,
      },
      model: {} as TChatConversation['model'],
    } as Partial<TChatConversation>);

    const groupedHistory = buildGroupedHistory([tempConversation], {}, (key) => key);
    const workspaceItem = groupedHistory.timelineSections[0]?.items[0];

    expect(workspaceItem?.type).toBe('workspace');
    expect(workspaceItem?.workspaceGroup?.workspace).toBe('/Users/bytedance/.contextgo-dev/codex-temp-1776134552686');
  });
});
