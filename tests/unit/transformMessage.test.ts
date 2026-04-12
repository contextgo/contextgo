/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import {
  isAgentConnectionErrorText,
  shouldSuppressAgentLifecycleStreamMessage,
  transformMessage,
} from '@/common/chat/chatLib';
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

  it('transforms interrupted messages into warning tips', () => {
    const result = transformMessage(makeMessage('interrupted', 'Interrupted by user.'));
    expect(result).toBeDefined();
    expect(result!.type).toBe('tips');
    expect(result!.position).toBe('center');
    expect(result!.content).toEqual({ content: 'Interrupted by user.', type: 'warning' });
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

  it('transforms schedule_event messages into structured chat messages', () => {
    const result = transformMessage(
      makeMessage('schedule_event', {
        source: 'assistant-skill',
        action: 'delete',
        scheduleId: 'schedule-1',
      })
    );

    expect(result).toBeDefined();
    expect(result!.type).toBe('schedule_event');
    expect(result!.position).toBe('left');
    expect(result!.content).toEqual({
      source: 'assistant-skill',
      action: 'delete',
      scheduleId: 'schedule-1',
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

  it('recognizes ACP/Codex runtime exit errors as transport-layer disconnect noise', () => {
    expect(isAgentConnectionErrorText('ACP process exited unexpectedly (code: 1, signal: null)')).toBe(true);
    expect(isAgentConnectionErrorText('Codex process exited unexpectedly (code: 1, signal: SIGTERM)')).toBe(true);
  });

  it('suppresses runtime exit errors from the live stream', () => {
    expect(
      shouldSuppressAgentLifecycleStreamMessage(
        makeMessage('error', 'ACP process exited unexpectedly (code: 1, signal: null)')
      )
    ).toBe(true);
    expect(
      shouldSuppressAgentLifecycleStreamMessage(
        makeMessage('error', 'Codex process exited unexpectedly (code: 1, signal: SIGTERM)')
      )
    ).toBe(true);
  });

  it('does not treat generic business errors as connection lifecycle noise', () => {
    expect(shouldSuppressAgentLifecycleStreamMessage(makeMessage('error', 'something went wrong'))).toBe(false);
  });
});
