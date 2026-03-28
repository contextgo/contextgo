/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { WeixinChatRequest } from '@process/channels/plugins/weixin/WeixinMonitor';
import { toUnifiedIncomingMessage, stripHtml } from '@process/channels/plugins/weixin/WeixinAdapter';

describe('toUnifiedIncomingMessage', () => {
  const baseRequest: WeixinChatRequest = {
    conversationId: 'user_abc123',
    text: 'Hello world',
  };

  it('maps conversationId to id, chatId, and user.id', () => {
    const msg = toUnifiedIncomingMessage(baseRequest);
    expect(msg.id).toBe('user_abc123');
    expect(msg.chatId).toBe('user_abc123');
    expect(msg.user.id).toBe('user_abc123');
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
