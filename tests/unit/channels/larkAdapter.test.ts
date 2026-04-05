/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { toUnifiedIncomingMessage } from '@process/channels/plugins/lark/LarkAdapter';

describe('LarkAdapter', () => {
  it('maps private chats to direct peers', () => {
    const message = toUnifiedIncomingMessage({
      event: {
        message: {
          message_id: 'msg-dm-1',
          chat_id: 'oc_dm_1',
          chat_type: 'p2p',
          content: JSON.stringify({ text: 'hello' }),
          message_type: 'text',
          create_time: '1710000000000',
        },
        sender: {
          sender_id: {
            user_id: 'ou_user_1',
          },
        },
      },
    });

    expect(message).not.toBeNull();
    expect(message?.chatId).toBe('oc_dm_1');
    expect(message?.peer).toEqual({
      key: 'oc_dm_1',
      platformChatId: 'oc_dm_1',
      scope: 'chat',
      chatType: 'p2p',
    });
  });

  it('maps Feishu topic messages to topic peers with parent group context', () => {
    const message = toUnifiedIncomingMessage({
      event: {
        message: {
          message_id: 'msg-topic-1',
          chat_id: 'oc_group_1',
          chat_type: 'topic',
          root_id: 'om_topic_root_1',
          thread_id: 'om_topic_root_1',
          content: JSON.stringify({ text: 'topic hello' }),
          message_type: 'text',
          create_time: '1710000000000',
        },
        sender: {
          sender_id: {
            user_id: 'ou_user_1',
          },
        },
      },
    });

    expect(message).not.toBeNull();
    expect(message?.chatId).toBe('oc_group_1');
    expect(message?.peer).toEqual({
      key: 'oc_group_1:thread:om_topic_root_1',
      platformChatId: 'oc_group_1',
      parentChatId: 'oc_group_1',
      threadId: 'om_topic_root_1',
      scope: 'thread',
      chatType: 'topic',
      containerId: 'oc_group_1',
      containerType: 'group',
    });
  });

  it('maps normal group chats to group peers', () => {
    const message = toUnifiedIncomingMessage({
      event: {
        message: {
          message_id: 'msg-group-1',
          chat_id: 'oc_group_2',
          chat_type: 'group',
          content: JSON.stringify({ text: 'group hello' }),
          message_type: 'text',
          create_time: '1710000000000',
        },
        sender: {
          sender_id: {
            user_id: 'ou_user_2',
          },
        },
      },
    });

    expect(message).not.toBeNull();
    expect(message?.chatId).toBe('oc_group_2');
    expect(message?.peer).toEqual({
      key: 'oc_group_2',
      platformChatId: 'oc_group_2',
      scope: 'chat',
      chatType: 'group',
    });
  });
});
