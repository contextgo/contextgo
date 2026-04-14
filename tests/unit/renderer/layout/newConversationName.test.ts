import { describe, expect, it } from 'vitest';

import {
  applyDefaultConversationName,
  normalizeConversationTitle,
} from '@/renderer/pages/conversation/utils/newConversationName';

describe('newConversationName', () => {
  it('keeps new conversations on the localized default title until auto-title runs', () => {
    expect(
      applyDefaultConversationName(
        {
          type: 'acp',
          extra: { workspace: '/tmp/demo' },
        },
        '新会话'
      )
    ).toEqual({
      type: 'acp',
      name: '新会话',
      extra: { workspace: '/tmp/demo' },
    });
  });

  it('drops technical prelude lines and extracts a human-readable title', () => {
    expect(
      normalizeConversationTitle('准备中\ncodex\n5s\n\n这个运行中的时候输入框上方这个样式是否可以优化一下，看起来太技术风格了')
    ).toBe('这个运行中的时候输入框上方这个样式是否可以优化一下，看起来太技术风格了');
  });

  it('falls back to the default title when content is empty after normalization', () => {
    expect(
      normalizeConversationTitle('[SCHEDULE_CREATE]\n\ncodex\n5s', {
        fallbackTitle: '新会话',
      })
    ).toBe('新会话');
  });
});
