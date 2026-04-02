/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { IConfigStorageRefer } from '@/common/config/storage';
import type {
  ClipboardConnectorConfig,
  ClipboardConnectorRuntimeStatus,
  ClipboardConnectorSnapshot,
} from '@/common/types/connectors/clipboard';
import { NodeClipboardObserverController } from './ClipboardObserverController.ts';
import type { ClipboardObserverController } from './ClipboardObserverController.ts';

const execFile = promisify(execFileCallback);
const CLIPBOARD_CONNECTOR_CONFIG_KEY = 'connector.clipboard.config';
const DEFAULT_POLL_INTERVAL_MS = 800;
const DEFAULT_MAX_TEXT_BYTES = 32_768;
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_DEDUPE_WINDOW_SECONDS = 300;

type ClipboardConnectorConfigStore = Pick<IConfigStorageRefer, 'connector.clipboard.config'>;

type ClipboardConnectorStore = {
  get<K extends keyof ClipboardConnectorConfigStore>(key: K): Promise<ClipboardConnectorConfigStore[K]>;
  set<K extends keyof ClipboardConnectorConfigStore>(
    key: K,
    value: ClipboardConnectorConfigStore[K]
  ): Promise<ClipboardConnectorConfigStore[K]>;
};

type ClipboardConnectorStoreFactory = () => Promise<ClipboardConnectorStore>;

export type ClipboardTextReader = () => Promise<string>;

const normalizeStringList = (items?: string[]): string[] => {
  if (!items || items.length === 0) {
    return [];
  }

  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, list) => list.indexOf(item) === index);
};

const normalizeInt = (value: unknown, fallback: number, min: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.floor(value));
};

export const normalizeClipboardConnectorConfig = (
  input?: Partial<ClipboardConnectorConfig> | null
): ClipboardConnectorConfig => {
  return {
    enabled: input?.enabled ?? false,
    mode: 'macos-pasteboard',
    pollIntervalMs: normalizeInt(input?.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, 200),
    retainFullText: input?.retainFullText ?? false,
    maxTextBytes: normalizeInt(input?.maxTextBytes, DEFAULT_MAX_TEXT_BYTES, 256),
    retentionDays: normalizeInt(input?.retentionDays, DEFAULT_RETENTION_DAYS, 1),
    dedupeWindowSeconds: normalizeInt(input?.dedupeWindowSeconds, DEFAULT_DEDUPE_WINDOW_SECONDS, 0),
    ignoreApps: normalizeStringList(input?.ignoreApps),
    ignorePatterns: normalizeStringList(input?.ignorePatterns),
  };
};

const truncateUtf8 = (value: string, maxBytes: number): string => {
  let result = '';

  for (const char of value) {
    const next = `${result}${char}`;
    if (Buffer.byteLength(next, 'utf8') > maxBytes) {
      break;
    }
    result = next;
  }

  return result;
};

const matchesIgnorePattern = (text: string, pattern: string): boolean => {
  try {
    return new RegExp(pattern, 'i').test(text);
  } catch {
    return text.toLowerCase().includes(pattern.toLowerCase());
  }
};

const defaultClipboardTextReader = async (): Promise<string> => {
  const { stdout } = await execFile('pbpaste');
  return stdout;
};

const buildUnavailableMessage = (platform: NodeJS.Platform): string => {
  return `Clipboard connector currently supports macOS pasteboard only (current platform: ${platform}).`;
};

const defaultClipboardConnectorStoreFactory: ClipboardConnectorStoreFactory = async () => {
  const { ProcessConfig } = await import('@process/utils/initStorage');
  return ProcessConfig;
};

export class ClipboardConnectorService {
  private state: ClipboardConnectorRuntimeStatus;

  constructor(
    private readonly storeOrFactory:
      | ClipboardConnectorStore
      | ClipboardConnectorStoreFactory = defaultClipboardConnectorStoreFactory,
    private readonly readClipboardText: ClipboardTextReader = defaultClipboardTextReader,
    private readonly platform: NodeJS.Platform = process.platform,
    private readonly observerController: ClipboardObserverController = new NodeClipboardObserverController()
  ) {
    this.state = {
      lifecycle: 'stopped',
      desiredState: 'stopped',
      available: this.platform === 'darwin',
      runtimeSource: 'connector-repo',
      note:
        this.platform === 'darwin'
          ? 'Clipboard runtime wrapper is available. Use sampleNow immediately; background observer wiring comes next.'
          : buildUnavailableMessage(this.platform),
    };
  }

  private isAvailable(): boolean {
    return this.platform === 'darwin';
  }

  private async getStore(): Promise<ClipboardConnectorStore> {
    if (typeof this.storeOrFactory === 'function') {
      return this.storeOrFactory();
    }

    return this.storeOrFactory;
  }

  async getConfig(): Promise<ClipboardConnectorConfig> {
    const store = await this.getStore();
    const stored = await store.get(CLIPBOARD_CONNECTOR_CONFIG_KEY);
    return normalizeClipboardConnectorConfig(stored ?? undefined);
  }

  async setConfig(updates: Partial<ClipboardConnectorConfig>): Promise<ClipboardConnectorConfig> {
    const current = await this.getConfig();
    const next = normalizeClipboardConnectorConfig({
      ...current,
      ...updates,
    });

    const store = await this.getStore();
    await store.set(CLIPBOARD_CONNECTOR_CONFIG_KEY, next);
    return next;
  }

  async getStatus(): Promise<ClipboardConnectorRuntimeStatus> {
    const observerRuntime = this.observerController.getRuntimeDetails();
    const available = this.isAvailable();
    const lifecycle = observerRuntime.running
      ? 'running'
      : this.state.desiredState === 'running' && available
        ? 'error'
        : this.state.lifecycle;

    return {
      ...this.state,
      lifecycle,
      available,
      note: !available ? buildUnavailableMessage(this.platform) : (observerRuntime.note ?? this.state.note),
      lastError: observerRuntime.lastError ?? this.state.lastError,
      observerPid: observerRuntime.pid,
      observerRepoDir: observerRuntime.repoDir,
      observerCommand: observerRuntime.command,
    };
  }

  async start(): Promise<ClipboardConnectorRuntimeStatus> {
    const now = Date.now();
    if (!this.isAvailable()) {
      this.state = {
        ...this.state,
        lifecycle: 'error',
        desiredState: 'running',
        available: false,
        lastStartAt: now,
        lastError: buildUnavailableMessage(this.platform),
        note: buildUnavailableMessage(this.platform),
      };
      return this.getStatus();
    }

    try {
      const observer = await this.observerController.start(await this.getConfig());
      this.state = {
        ...this.state,
        lifecycle: 'running',
        desiredState: 'running',
        available: true,
        lastStartAt: now,
        lastError: undefined,
        note: observer.note,
        observerPid: observer.pid,
        observerRepoDir: observer.repoDir,
        observerCommand: observer.command,
      };
      return this.getStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state = {
        ...this.state,
        lifecycle: 'error',
        desiredState: 'running',
        available: true,
        lastStartAt: now,
        lastError: message,
        note: message,
      };
      return this.getStatus();
    }
  }

  async stop(): Promise<ClipboardConnectorRuntimeStatus> {
    await this.observerController.stop();

    this.state = {
      ...this.state,
      lifecycle: 'stopped',
      desiredState: 'stopped',
      lastStopAt: Date.now(),
      lastError: undefined,
      note: this.isAvailable() ? 'Clipboard runtime wrapper is stopped.' : buildUnavailableMessage(this.platform),
      observerPid: undefined,
      observerRepoDir: undefined,
      observerCommand: undefined,
    };
    return this.getStatus();
  }

  async sampleNow(): Promise<ClipboardConnectorSnapshot | null> {
    if (!this.isAvailable()) {
      throw new Error(buildUnavailableMessage(this.platform));
    }

    const config = await this.getConfig();
    const capturedAt = Date.now();
    const rawText = (await this.readClipboardText()).replace(/\r\n/g, '\n').trim();

    if (!rawText) {
      this.state = {
        ...this.state,
        lastSampleAt: capturedAt,
        lastError: undefined,
      };
      return null;
    }

    if (config.ignorePatterns.some((pattern) => matchesIgnorePattern(rawText, pattern))) {
      this.state = {
        ...this.state,
        lastSampleAt: capturedAt,
        lastError: undefined,
      };
      return null;
    }

    const originalBytes = Buffer.byteLength(rawText, 'utf8');
    const text = config.retainFullText ? rawText : truncateUtf8(rawText, config.maxTextBytes);
    const textBytes = Buffer.byteLength(text, 'utf8');
    const truncated = textBytes < originalBytes;

    this.state = {
      ...this.state,
      lastSampleAt: capturedAt,
      lastError: undefined,
    };

    return {
      text,
      truncated,
      textBytes,
      capturedAt,
      source: 'pbpaste',
    };
  }
}
