/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { WeixinChatRequest } from '@process/channels/plugins/weixin/WeixinMonitor';
import { toUnifiedIncomingMessage, stripHtml } from '@process/channels/plugins/weixin/WeixinAdapter';
import { buildDingTalkPeer, toUnifiedIncomingMessage as toUnifiedDingTalkMessage } from '@process/channels/plugins/dingtalk/DingTalkAdapter';

describe('toUnifiedIncomingMessage', () => {
  const baseRequest: WeixinChatRequest = {
    conversationId: 'user_abc123',
    text: 'Hello world',
  };

  it('maps conversationId to id, chatId, user.id, and a private peer key', () => {
    const msg = toUnifiedIncomingMessage(baseRequest);
    expect(msg.id).toBe('user_abc123');
    expect(msg.chatId).toBe('user_abc123');
    expect(msg.user.id).toBe('user_abc123');
    expect(msg.peer).toEqual({
      key: 'user_abc123',
      platformChatId: 'user_abc123',
      scope: 'chat',
      chatType: 'private',
    });
  });

  it('marks chatroom-style conversations as group peers', () => {
    const msg = toUnifiedIncomingMessage({
      conversationId: 'team_room@chatroom',
      text: 'hello group',
    });

    expect(msg.peer).toEqual({
      key: 'team_room@chatroom',
      platformChatId: 'team_room@chatroom',
      scope: 'chat',
      chatType: 'group',
    });
  });

  it('uses last 6 chars of conversationId as displayName fallback', () => {
    const msg = toUnifiedIncomingMessage(baseRequest);
    expect(msg.user.displayName).toBe('user_abc123'.slice(-6));
  });

  it('sets platform to weixin', () => {
    const msg = toUnifiedIncomingMessage(baseRequest);
    expect(msg.platform).toBe('weixin');
  });

  it('maps text to content.text with type text', () => {
    const msg = toUnifiedIncomingMessage(baseRequest);
    expect(msg.content.type).toBe('text');
    expect(msg.content.text).toBe('Hello world');
  });

  it('maps image attachments to photo content with attachment metadata', () => {
    const msg = toUnifiedIncomingMessage({
      conversationId: 'user_media',
      text: 'check this',
      attachments: [
        {
          kind: 'image',
          filePath: '/tmp/img.jpg',
          fileName: 'img.jpg',
          mimeType: 'image/jpeg',
          size: 1234,
        },
      ],
    });

    expect(msg.content.type).toBe('photo');
    expect(msg.content.attachments?.[0]).toEqual({
      type: 'photo',
      fileId: '/tmp/img.jpg',
      fileName: 'img.jpg',
      mimeType: 'image/jpeg',
      size: 1234,
      duration: undefined,
    });
  });

  it('maps file attachments to document content', () => {
    const msg = toUnifiedIncomingMessage({
      conversationId: 'user_file',
      attachments: [
        {
          kind: 'file',
          filePath: '/tmp/doc.pdf',
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
        },
      ],
    });

    expect(msg.content.type).toBe('document');
    expect(msg.content.attachments?.[0]?.type).toBe('document');
    expect(msg.content.attachments?.[0]?.fileId).toBe('/tmp/doc.pdf');
  });

  it('provides a numeric timestamp', () => {
    const before = Date.now();
    const msg = toUnifiedIncomingMessage(baseRequest);
    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
  });
});

describe('stripHtml', () => {
  it('strips plain HTML tags', () => {
    expect(stripHtml('<b>bold</b> text')).toBe('bold text');
  });

  it('decodes standard HTML entities', () => {
    expect(stripHtml('Hello &amp; World')).toBe('Hello & World');
    expect(stripHtml('&quot;quoted&quot;')).toBe('"quoted"');
    expect(stripHtml('it&#39;s')).toBe("it's");
    expect(stripHtml('a&nbsp;b')).toBe('a b');
  });

  it('strips entity-encoded tag names (e.g. from code blocks)', () => {
    // &lt;tag&gt; decodes to <tag> which is then stripped — security over fidelity
    expect(stripHtml('Use &lt;b&gt; for bold')).toBe('Use  for bold');
  });

  it('strips entity-encoded HTML tags (XSS vector)', () => {
    expect(stripHtml('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('alert(1)');
    expect(stripHtml('&lt;img src=x onerror=alert(1)&gt;')).toBe('');
  });

  it('strips double-encoded entity tags (&amp;lt;script&amp;gt;)', () => {
    const result = stripHtml('&amp;lt;script&amp;gt;xss&amp;lt;/script&amp;gt;');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('returns plain text without any HTML tags', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });
});


describe('DingTalkAdapter', () => {
  it('maps private conversations to user-scoped peers', () => {
    const msg = toUnifiedDingTalkMessage({
      msgId: 'dt-msg-1',
      senderStaffId: 'staff-1',
      senderNick: 'Alice',
      conversationType: '1',
      msgtype: 'text',
      text: { content: 'hello' },
      createAt: 1710000000000,
    });

    expect(msg).not.toBeNull();
    expect(msg?.chatId).toBe('user:staff-1');
    expect(msg?.peer).toEqual({
      key: 'user:staff-1',
      platformChatId: 'user:staff-1',
      scope: 'chat',
      chatType: 'private',
    });
  });

  it('maps group conversations to group-scoped peers and strips bot mentions', () => {
    const msg = toUnifiedDingTalkMessage({
      msgId: 'dt-msg-2',
      senderStaffId: 'staff-2',
      senderNick: 'Bob',
      conversationId: 'cid-1',
      conversationType: '2',
      msgtype: 'text',
      text: { content: '@ContextGo 请帮我总结' },
      createAt: 1710000001000,
    });

    expect(msg).not.toBeNull();
    expect(msg?.chatId).toBe('group:cid-1');
    expect(msg?.peer).toEqual({
      key: 'group:cid-1',
      platformChatId: 'group:cid-1',
      scope: 'chat',
      chatType: 'group',
    });
    expect(msg?.content.text).toBe('请帮我总结');
  });

  it('exposes action callbacks on the same peer identity', () => {
    const peer = buildDingTalkPeer({
      conversationId: 'cid-9',
      conversationType: '2',
      senderStaffId: 'staff-9',
    });

    const msg = toUnifiedDingTalkMessage(
      {
        msgId: 'dt-action-1',
        senderStaffId: 'staff-9',
        senderNick: 'Carol',
        conversationId: 'cid-9',
        conversationType: '2',
      },
      {
        type: 'system',
        name: 'session.new',
      }
    );

    expect(peer).toEqual({
      key: 'group:cid-9',
      platformChatId: 'group:cid-9',
      scope: 'chat',
      chatType: 'group',
    });
    expect(msg?.peer).toEqual(peer);
    expect(msg?.content.type).toBe('action');
  });
});
