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
        channelId: 'channel-1',
        createdTimestamp: 1740000000123,
        reference: null,
      } as any,
      '123'
    );

    expect(message).not.toBeNull();
    expect(message?.platform).toBe('discord');
    expect(message?.chatId).toBe('channel-1');
    expect(message?.content.text).toBe('hello there');
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
