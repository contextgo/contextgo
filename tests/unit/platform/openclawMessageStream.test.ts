/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';

import {
  isOpenClawActivityMessageType,
  isOpenClawConnectionErrorMessage,
  isOpenClawLifecycleStatusMessage,
  resolveOpenClawRuntimeStatus,
  shouldSuppressOpenClawStreamMessage,
} from '@/renderer/pages/conversation/platforms/openclaw/messageStream';

describe('openclaw message stream filtering', () => {
  it('suppresses lifecycle status messages from the chat stream', () => {
    expect(
      isOpenClawLifecycleStatusMessage({
        type: 'agent_status',
        data: {
          backend: 'openclaw-gateway',
          status: 'disconnected',
        },
      })
    ).toBe(true);

    expect(
      shouldSuppressOpenClawStreamMessage({
        type: 'agent_status',
        data: {
          backend: 'openclaw-gateway',
          status: 'session_active',
        },
      })
    ).toBe(true);
  });

  it('suppresses connection-related errors but keeps regular errors visible', () => {
    expect(
      isOpenClawConnectionErrorMessage({
        type: 'error',
        data: 'Gateway disconnected: Gateway shutdown',
      })
    ).toBe(true);

    expect(
      isOpenClawConnectionErrorMessage({
        type: 'error',
        data: 'Connection error: websocket failed',
      })
    ).toBe(true);

    expect(
      shouldSuppressOpenClawStreamMessage({
        type: 'error',
        data: 'Permission request timed out',
      })
    ).toBe(false);
  });

  it('keeps normal OpenClaw content in the message stream', () => {
    expect(
      shouldSuppressOpenClawStreamMessage({
        type: 'content',
        data: 'hello',
      })
    ).toBe(false);
  });

  it('treats thought and streamed reply updates as activity that should keep the footer stable', () => {
    expect(isOpenClawActivityMessageType({ type: 'thought' } as never)).toBe(true);
    expect(isOpenClawActivityMessageType({ type: 'content' } as never)).toBe(true);
    expect(isOpenClawActivityMessageType({ type: 'acp_permission' } as never)).toBe(true);
    expect(isOpenClawActivityMessageType({ type: 'finish' } as never)).toBe(false);
    expect(isOpenClawActivityMessageType({ type: 'agent_status' } as never)).toBe(false);
  });

  it('derives the initial runtime status from connection state instead of session existence alone', () => {
    expect(resolveOpenClawRuntimeStatus({ isConnected: true, hasActiveSession: true })).toBe('session_active');
    expect(resolveOpenClawRuntimeStatus({ isConnected: true, hasActiveSession: false })).toBe('connected');
    expect(
      resolveOpenClawRuntimeStatus({ isConnected: false, hasActiveSession: true, sessionKey: 'agent:main:1' })
    ).toBe('disconnected');
    expect(resolveOpenClawRuntimeStatus({ isConnected: false, hasActiveSession: false })).toBeNull();
  });
});
