/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';

vi.mock('@/renderer/utils/emitter', () => ({
  addEventListener: vi.fn(() => () => {}),
}));

import {
  ConversationTabsProvider,
  useConversationTabs,
} from '@/renderer/pages/conversation/hooks/ConversationTabsContext';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(ConversationTabsProvider, null, children);

const createGroupConversation = (): Extract<TChatConversation, { type: 'group' }> =>
  ({
    id: 'group-1',
    type: 'group',
    name: 'Group',
    createTime: 1,
    modifyTime: 1,
    model: { provider: 'openai', model: 'gpt-4.1' },
    extra: {
      workspace: '/Users/bytedance/project/skills',
      customWorkspace: true,
      participants: [],
      orchestration: {
        kind: 'discussion',
        mode: 'debate',
        rounds: 2,
      },
    },
  }) as Extract<TChatConversation, { type: 'group' }>;

const createGroupChildConversation = (id: string, name: string): TChatConversation =>
  ({
    id,
    type: 'acp',
    name,
    createTime: 1,
    modifyTime: 1,
    model: { provider: 'openai', model: 'gpt-4.1' },
    extra: {
      workspace: '/Users/bytedance/project/skills',
      customWorkspace: true,
      groupMeta: {
        parentGroupId: 'group-1',
        participantId: id,
        participantName: name,
        hiddenFromHistory: true,
      },
    },
  }) as TChatConversation;

const createNormalConversation = (): TChatConversation =>
  ({
    id: 'normal-1',
    type: 'acp',
    name: 'Normal Session',
    createTime: 1,
    modifyTime: 1,
    model: { provider: 'openai', model: 'gpt-4.1' },
    extra: {
      workspace: '/Users/bytedance/project/ContextGo',
      customWorkspace: true,
    },
  }) as TChatConversation;

describe('ConversationTabsContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('closes group child tabs together when closing a group tab', () => {
    const { result } = renderHook(() => useConversationTabs(), { wrapper });
    const groupConversation = createGroupConversation();
    const childConversation1 = createGroupChildConversation('child-1', 'Codex');
    const childConversation2 = createGroupChildConversation('child-2', 'Claude Code');
    const normalConversation = createNormalConversation();

    act(() => {
      result.current.openTabsForConversations(
        [groupConversation, childConversation1, childConversation2, normalConversation],
        normalConversation.id
      );
    });

    expect(result.current.openTabs.map((tab) => tab.id)).toEqual(['group-1', 'child-1', 'child-2', 'normal-1']);

    act(() => {
      result.current.closeTab('group-1');
    });

    expect(result.current.openTabs.map((tab) => tab.id)).toEqual(['normal-1']);
    expect(result.current.activeTabId).toBe('normal-1');
  });

  it('keeps the group tab when closing only a child session tab', () => {
    const { result } = renderHook(() => useConversationTabs(), { wrapper });
    const groupConversation = createGroupConversation();
    const childConversation1 = createGroupChildConversation('child-1', 'Codex');
    const childConversation2 = createGroupChildConversation('child-2', 'Claude Code');

    act(() => {
      result.current.openTabsForConversations(
        [groupConversation, childConversation1, childConversation2],
        childConversation2.id
      );
    });

    act(() => {
      result.current.closeTab('child-1');
    });

    expect(result.current.openTabs.map((tab) => tab.id)).toEqual(['group-1', 'child-2']);
    expect(result.current.activeTabId).toBe('child-2');
  });
});
