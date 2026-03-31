/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { transformMessage } from '@/common/chat/chatLib';
import type { IResponseMessage } from '@/common/adapter/ipcBridge';

const makeMessage = (type: string, data: unknown = 'test'): IResponseMessage => ({
  type,
  msg_id: 'msg-1',
  conversation_id: 'conv-1',
  data,
});

describe('transformMessage', () => {
  it('transforms error messages into tips with error type', () => {
    const result = transformMessage(makeMessage('error', 'something went wrong'));
    expect(result).toBeDefined();
    expect(result!.type).toBe('tips');
    expect(result!.content).toEqual({ content: 'something went wrong', type: 'error' });
  });

  it('transforms content messages into text', () => {
    const result = transformMessage(makeMessage('content', 'hello'));
    expect(result).toBeDefined();
    expect(result!.type).toBe('text');
    expect(result!.position).toBe('left');
  });

  it('transforms user_content messages into right-aligned text', () => {
    const result = transformMessage(makeMessage('user_content', 'user msg'));
    expect(result).toBeDefined();
    expect(result!.type).toBe('text');
    expect(result!.position).toBe('right');
  });

  it('transforms tips messages into centered tips', () => {
    const result = transformMessage(
      makeMessage('tips', {
        content: 'Sidecar files exported',
        type: 'success',
        actions: [
          {
            label: 'Open Markdown',
            action: 'open-file',
            path: '/tmp/export/latest.md',
          },
          {
            label: 'Show In Folder',
            action: 'show-item-in-folder',
            path: '/tmp/export/latest.md',
          },
        ],
      })
    );
    expect(result).toBeDefined();
    expect(result!.type).toBe('tips');
    expect(result!.position).toBe('center');
    expect(result!.content).toEqual({
      content: 'Sidecar files exported',
      type: 'success',
      actions: [
        {
          label: 'Open Markdown',
          action: 'open-file',
          path: '/tmp/export/latest.md',
        },
        {
          label: 'Show In Folder',
          action: 'show-item-in-folder',
          path: '/tmp/export/latest.md',
        },
      ],
    });
  });

  it('returns undefined for transient message types', () => {
    for (const type of ['start', 'finish', 'thought', 'system', 'acp_model_info', 'request_trace']) {
      expect(transformMessage(makeMessage(type))).toBeUndefined();
    }
  });

  it('warns and returns undefined for unknown message types instead of throwing', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = transformMessage(makeMessage('some_unknown_type'));
    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Unsupported message type 'some_unknown_type'"));
    warnSpy.mockRestore();
  });
});
