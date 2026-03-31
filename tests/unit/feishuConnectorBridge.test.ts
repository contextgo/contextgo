/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlers, emitters, mockService } = vi.hoisted(() => ({
  handlers: {} as Record<string, ((payload: unknown) => Promise<unknown>) | undefined>,
  emitters: { statusChanged: vi.fn() },
  mockService: {
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    getStatus: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    feishuConnector: {
      getConfig: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getConfig = fn)) },
      setConfig: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.setConfig = fn)) },
      getStatus: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.getStatus = fn)) },
      start: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.start = fn)) },
      stop: { provider: vi.fn((fn: (payload: unknown) => Promise<unknown>) => (handlers.stop = fn)) },
      statusChanged: { emit: emitters.statusChanged },
    },
  },
}));

vi.mock('@process/services/space/connectors/feishu/FeishuConnectorService', () => ({
  FeishuConnectorService: vi.fn(
    class FeishuConnectorServiceMock {
      getConfig = mockService.getConfig;
      setConfig = mockService.setConfig;
      getStatus = mockService.getStatus;
      start = mockService.start;
      stop = mockService.stop;
    }
  ),
}));

import { initFeishuConnectorBridge } from '../../src/process/bridge/feishuConnectorBridge';

describe('feishuConnectorBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((key) => {
      handlers[key] = undefined;
    });
  });

  it('returns config and starts sidecar', async () => {
    mockService.getConfig.mockResolvedValueOnce({ appId: 'cli_xxx' });
    mockService.start.mockResolvedValueOnce({ lifecycle: 'running' });
    mockService.getStatus.mockResolvedValueOnce({ lifecycle: 'running' });
    initFeishuConnectorBridge();

    await expect(handlers.getConfig?.({})).resolves.toEqual({ success: true, data: { appId: 'cli_xxx' } });
    await expect(handlers.start?.({})).resolves.toEqual({ success: true, data: { lifecycle: 'running' } });
    expect(emitters.statusChanged).toHaveBeenCalledWith({ lifecycle: 'running' });
  });
});
