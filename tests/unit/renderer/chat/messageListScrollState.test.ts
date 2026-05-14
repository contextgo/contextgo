import { describe, expect, it } from 'vitest';

import {
  getInitialConversationBottomItemIndex,
  shouldApplyInitialConversationBottomPosition,
} from '@/renderer/pages/conversation/Messages/scrollState';

describe('messageList scroll state', () => {
  it('does not apply initial bottom positioning without a conversation id', () => {
    expect(shouldApplyInitialConversationBottomPosition(undefined)).toBe(false);
  });

  it('applies initial bottom positioning whenever entering a conversation', () => {
    const conversationId = 'conversation-scroll-entry';

    expect(shouldApplyInitialConversationBottomPosition(conversationId)).toBe(true);
    expect(getInitialConversationBottomItemIndex(conversationId, 3)).toBe(2);
    expect(shouldApplyInitialConversationBottomPosition(conversationId)).toBe(true);
    expect(getInitialConversationBottomItemIndex(conversationId, 3)).toBe(2);
  });

  it('waits for items before assigning the initial bottom target', () => {
    expect(getInitialConversationBottomItemIndex('conversation-scroll-empty', 0)).toBeNull();
    expect(getInitialConversationBottomItemIndex('conversation-scroll-empty', 5)).toBe(4);
  });

  it('skips initial bottom positioning when jumping to a specific message', () => {
    expect(shouldApplyInitialConversationBottomPosition('conversation-scroll-target', 'message-123')).toBe(false);
    expect(getInitialConversationBottomItemIndex('conversation-scroll-target', 5, 'message-123')).toBeNull();
  });
});
