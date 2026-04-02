/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';

import {
  FeishuConnectorService,
  normalizeFeishuConnectorConfig,
} from '../../src/process/services/space/connectors/feishu/FeishuConnectorService';
import type { FeishuConnectorConfig } from '../../src/common/types/connectors/feishu';

type FeishuStore = {
  get: <K extends 'connector.feishu.openapi.config'>(
    key: K
  ) => Promise<{ 'connector.feishu.openapi.config'?: FeishuConnectorConfig }[K]>;
  set: <K extends 'connector.feishu.openapi.config'>(
    key: K,
    value: { 'connector.feishu.openapi.config'?: FeishuConnectorConfig }[K]
  ) => Promise<{ 'connector.feishu.openapi.config'?: FeishuConnectorConfig }[K]>;
};

const createStore = (initial?: FeishuConnectorConfig): FeishuStore => {
  let state = initial;
  return {
    get: vi.fn(async () => state),
    set: vi.fn(async (_key, value) => {
      state = value;
      return value;
    }),
  };
};

const createController = () => {
  let running = false;
  return {
    start: vi.fn(async () => {
      running = true;
      return {
        pid: 9876,
        command: 'npx',
        args: ['-y', '@larksuiteoapi/lark-mcp'],
        note: 'feishu sidecar started',
      };
    }),
    stop: vi.fn(async () => {
      running = false;
    }),
    getRuntimeDetails: vi.fn(() => ({
      running,
      pid: running ? 9876 : undefined,
      command: 'npx',
      args: ['-y', '@larksuiteoapi/lark-mcp'],
    })),
  };
};

describe('FeishuConnectorService', () => {
  it('normalizes config defaults', () => {
    expect(normalizeFeishuConnectorConfig()).toEqual({
      enabled: false,
      appId: '',
      appSecret: '',
      apiDomain: 'open.feishu.cn',
      useOAuth: false,
      command: '@larksuiteoapi/lark-mcp',
      args: [],
    });
  });

  it('persists config updates', async () => {
    const service = new FeishuConnectorService(createStore(), createController());
    const config = await service.setConfig({ appId: 'cli_xxx', appSecret: 'secret', enabled: true });

    expect(config.enabled).toBe(true);
    expect(config.appId).toBe('cli_xxx');
    expect(config.appSecret).toBe('secret');
  });

  it('refuses to start without credentials', async () => {
    const service = new FeishuConnectorService(createStore(), createController());
    const status = await service.start();

    expect(status.lifecycle).toBe('error');
    expect(status.hasCredentials).toBe(false);
    expect(status.lastError).toContain('App ID and App Secret');
  });

  it('starts managed sidecar with credentials', async () => {
    const controller = createController();
    const service = new FeishuConnectorService(
      createStore({
        enabled: true,
        appId: 'cli_xxx',
        appSecret: 'secret',
        apiDomain: 'open.feishu.cn',
        useOAuth: false,
        command: '@larksuiteoapi/lark-mcp',
        args: [],
      }),
      controller
    );

    const status = await service.start();

    expect(controller.start).toHaveBeenCalledOnce();
    expect(status).toMatchObject({
      lifecycle: 'running',
      hasCredentials: true,
      pid: 9876,
      command: 'npx',
    });
  });
});
