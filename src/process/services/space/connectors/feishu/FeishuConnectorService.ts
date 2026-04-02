/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IConfigStorageRefer } from '@/common/config/storage';
import type { FeishuConnectorConfig, FeishuConnectorRuntimeStatus } from '@/common/types/connectors/feishu';
import { NodeFeishuOpenapiController } from './FeishuOpenapiController.ts';
import type { FeishuOpenapiController } from './FeishuOpenapiController.ts';

const FEISHU_CONNECTOR_CONFIG_KEY = 'connector.feishu.openapi.config';

type FeishuConnectorConfigStore = Pick<IConfigStorageRefer, 'connector.feishu.openapi.config'>;

type FeishuConnectorStore = {
  get<K extends keyof FeishuConnectorConfigStore>(key: K): Promise<FeishuConnectorConfigStore[K]>;
  set<K extends keyof FeishuConnectorConfigStore>(
    key: K,
    value: FeishuConnectorConfigStore[K]
  ): Promise<FeishuConnectorConfigStore[K]>;
};

type FeishuConnectorStoreFactory = () => Promise<FeishuConnectorStore>;

const defaultFeishuStoreFactory: FeishuConnectorStoreFactory = async () => {
  const { ProcessConfig } = await import('@process/utils/initStorage');
  return ProcessConfig;
};

export const normalizeFeishuConnectorConfig = (
  input?: Partial<FeishuConnectorConfig> | null
): FeishuConnectorConfig => ({
  enabled: input?.enabled ?? false,
  appId: input?.appId?.trim() ?? '',
  appSecret: input?.appSecret?.trim() ?? '',
  apiDomain: input?.apiDomain === 'open.larksuite.com' ? 'open.larksuite.com' : 'open.feishu.cn',
  useOAuth: input?.useOAuth ?? false,
  command: input?.command?.trim() || '@larksuiteoapi/lark-mcp',
  args: Array.isArray(input?.args) ? input!.args.filter(Boolean) : [],
});

export class FeishuConnectorService {
  private state: FeishuConnectorRuntimeStatus = {
    lifecycle: 'stopped',
    desiredState: 'stopped',
    available: true,
    note: 'Feishu OpenAPI connector is ready for app credentials and managed sidecar launch.',
    hasCredentials: false,
  };

  constructor(
    private readonly storeOrFactory: FeishuConnectorStore | FeishuConnectorStoreFactory = defaultFeishuStoreFactory,
    private readonly controller: FeishuOpenapiController = new NodeFeishuOpenapiController()
  ) {}

  private async getStore(): Promise<FeishuConnectorStore> {
    if (typeof this.storeOrFactory === 'function') {
      return this.storeOrFactory();
    }

    return this.storeOrFactory;
  }

  async getConfig(): Promise<FeishuConnectorConfig> {
    const store = await this.getStore();
    const stored = await store.get(FEISHU_CONNECTOR_CONFIG_KEY);
    return normalizeFeishuConnectorConfig(stored ?? undefined);
  }

  async setConfig(updates: Partial<FeishuConnectorConfig>): Promise<FeishuConnectorConfig> {
    const current = await this.getConfig();
    const next = normalizeFeishuConnectorConfig({
      ...current,
      ...updates,
    });
    const store = await this.getStore();
    await store.set(FEISHU_CONNECTOR_CONFIG_KEY, next);
    return next;
  }

  async getStatus(): Promise<FeishuConnectorRuntimeStatus> {
    const config = await this.getConfig();
    const details = this.controller.getRuntimeDetails();
    const hasCredentials = Boolean(config.appId && config.appSecret);

    return {
      ...this.state,
      lifecycle: details.running ? 'running' : this.state.desiredState === 'running' ? 'error' : this.state.lifecycle,
      hasCredentials,
      command: details.command,
      args: details.args,
      pid: details.pid,
      lastError: details.lastError ?? this.state.lastError,
      note: details.running ? 'Managed Feishu OpenAPI sidecar is running.' : this.state.note,
    };
  }

  async start(): Promise<FeishuConnectorRuntimeStatus> {
    const config = await this.getConfig();
    const now = Date.now();

    if (!config.appId || !config.appSecret) {
      this.state = {
        ...this.state,
        lifecycle: 'error',
        desiredState: 'running',
        hasCredentials: false,
        lastError: 'Feishu connector requires App ID and App Secret before launch.',
        note: 'Feishu connector requires App ID and App Secret before launch.',
        lastStartAt: now,
      };
      return this.getStatus();
    }

    try {
      const result = await this.controller.start(config);
      this.state = {
        ...this.state,
        lifecycle: 'running',
        desiredState: 'running',
        hasCredentials: true,
        command: result.command,
        args: result.args,
        pid: result.pid,
        lastError: undefined,
        note: result.note,
        lastStartAt: now,
      };
      return this.getStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state = {
        ...this.state,
        lifecycle: 'error',
        desiredState: 'running',
        hasCredentials: true,
        lastError: message,
        note: message,
        lastStartAt: now,
      };
      return this.getStatus();
    }
  }

  async stop(): Promise<FeishuConnectorRuntimeStatus> {
    await this.controller.stop();
    this.state = {
      ...this.state,
      lifecycle: 'stopped',
      desiredState: 'stopped',
      pid: undefined,
      lastError: undefined,
      note: 'Managed Feishu OpenAPI sidecar is stopped.',
      lastStopAt: Date.now(),
    };
    return this.getStatus();
  }
}
