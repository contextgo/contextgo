import { describe, expect, it } from 'vitest';
import {
  convertHtmlToDiscordMarkdown,
  toDiscordMessagePayload,
  toUnifiedActionMessage,
  toUnifiedIncomingMessage,
} from '@process/channels/plugins/discord/DiscordAdapter';

describe('DiscordAdapter', () => {
  it('converts html to Discord markdown', () => {
    expect(convertHtmlToDiscordMarkdown('<b>Hello</b><br><code>world</code>')).toBe('**Hello**\n`world`');
  });

  it('normalizes incoming mention messages', () => {
    const message = toUnifiedIncomingMessage(
      {
        id: 'msg-1',
        content: '<@123> hello there',
        author: {
          id: 'user-1',
          username: 'alice',
          globalName: 'Alice',
          displayAvatarURL: () => 'https://example.com/avatar.png',
        },
        member: null,
        guildId: 'guild-1',
        channelId: 'channel-1',
        channel: {
          id: 'channel-1',
          parentId: null,
          isThread: () => false,
          isDMBased: () => false,
        },
        createdTimestamp: 1740000000123,
        reference: null,
      } as any,
      '123'
    );

    expect(message).not.toBeNull();
    expect(message?.platform).toBe('discord');
    expect(message?.chatId).toBe('channel-1');
    expect(message?.peer).toEqual({
      key: 'channel-1',
      platformChatId: 'channel-1',
      scope: 'chat',
      chatType: 'group',
      containerId: 'guild-1',
      containerType: 'server',
    });
    expect(message?.content.text).toBe('hello there');
  });


  it('maps Discord thread messages to parent transport chat and thread peer key', () => {
    const message = toUnifiedIncomingMessage(
      {
        id: 'msg-thread-1',
        content: 'thread update',
        author: {
          id: 'user-1',
          username: 'alice',
          globalName: 'Alice',
          displayAvatarURL: () => 'https://example.com/avatar.png',
        },
        member: null,
        guildId: 'guild-1',
        channelId: 'thread-1',
        channel: {
          id: 'thread-1',
          parentId: 'channel-parent-1',
          isThread: () => true,
          isDMBased: () => false,
        },
        createdTimestamp: 1740000000123,
        reference: { messageId: 'origin-1' },
      } as any,
      '123'
    );

    expect(message).not.toBeNull();
    expect(message?.chatId).toBe('channel-parent-1');
    expect(message?.peer).toEqual({
      key: 'channel-parent-1:thread:thread-1',
      platformChatId: 'channel-parent-1',
      parentChatId: 'channel-parent-1',
      threadId: 'thread-1',
      scope: 'thread',
      chatType: 'thread',
      containerId: 'guild-1',
      containerType: 'server',
    });
    expect(message?.replyToMessageId).toBe('origin-1');
  });

  it('parses Discord button interactions into actions', () => {
    const message = toUnifiedActionMessage(
      {
        id: 'interaction-1',
        channelId: 'channel-1',
        customId: 'ctxgo',
        user: {
          id: 'user-1',
          username: 'alice',
          globalName: 'Alice',
          displayAvatarURL: () => 'https://example.com/avatar.png',
        },
        member: null,
        message: { id: 'message-1' },
      } as any,
      {
        type: 'system',
        name: 'agent.select',
        params: { agentKey: 'gemini' },
      }
    );

    expect(message).not.toBeNull();
    expect(message?.action?.name).toBe('agent.select');
    expect(message?.action?.type).toBe('system');
    expect(message?.action?.params).toEqual({ agentKey: 'gemini' });
  });

  it('serializes buttons into Discord components', () => {
    const payload = toDiscordMessagePayload(
      {
        type: 'text',
        text: '<b>Hello</b>',
        buttons: [[{ label: 'Refresh', action: 'pairing.refresh' }]],
      },
      () => 'custom-id'
    );

    expect(payload.content).toBe('**Hello**');
    expect(payload.components).toBeDefined();
    expect(payload.components).toHaveLength(1);
    expect(payload.components?.[0].components).toHaveLength(1);
  });
});
