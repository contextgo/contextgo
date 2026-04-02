/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { IConfigStorageRefer } from '@/common/config/storage';
import type {
  GoogleDriveAuthRequest,
  GoogleDriveAuthResult,
  GoogleDriveConnectorConfig,
  GoogleDriveConnectorRuntimeStatus,
  GoogleDriveFile,
} from '@/common/types/connectors/googleDrive';
import { NodeGoogleDriveController, resolveDefaultLocalProxyEnv } from './GoogleDriveController.ts';
import type { GoogleDriveController } from './GoogleDriveController.ts';

const execFile = promisify(execFileCallback);
const GOOGLE_DRIVE_CONNECTOR_CONFIG_KEY = 'connector.googleDrive.config';
const DEFAULT_GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];

type GoogleDriveConfigStore = Pick<IConfigStorageRefer, 'connector.googleDrive.config'>;

type GoogleDriveStore = {
  get<K extends keyof GoogleDriveConfigStore>(key: K): Promise<GoogleDriveConfigStore[K]>;
  set<K extends keyof GoogleDriveConfigStore>(
    key: K,
    value: GoogleDriveConfigStore[K]
  ): Promise<GoogleDriveConfigStore[K]>;
};

type GoogleDriveStoreFactory = () => Promise<GoogleDriveStore>;

type GoogleDriveCachedToken = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expiry?: string;
  scope?: string;
};

const defaultGoogleDriveStoreFactory: GoogleDriveStoreFactory = async () => {
  const { ProcessConfig } = await import('@process/utils/initStorage');
  return ProcessConfig;
};

const normalizeScopes = (scopes?: string[]): string[] => {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return [...DEFAULT_GOOGLE_DRIVE_SCOPES];
  }

  return scopes.map((scope) => scope.trim()).filter(Boolean);
};

export const normalizeGoogleDriveConnectorConfig = (
  input?: Partial<GoogleDriveConnectorConfig> | null
): GoogleDriveConnectorConfig => ({
  enabled: input?.enabled ?? false,
  clientId: input?.clientId?.trim() ?? '',
  clientSecret: input?.clientSecret?.trim() ?? '',
  scopes: normalizeScopes(input?.scopes),
  command: input?.command?.trim() || 'go',
  args: Array.isArray(input?.args) && input.args.length > 0 ? [...input.args] : ['run', '.'],
});

export class GoogleDriveConnectorService {
  private state: GoogleDriveConnectorRuntimeStatus = {
    lifecycle: 'stopped',
    desiredState: 'stopped',
    available: true,
    note: 'Google Drive connector is ready for OAuth app credentials and a managed Go sidecar.',
    hasCredentials: false,
  };

  constructor(
    private readonly storeOrFactory: GoogleDriveStore | GoogleDriveStoreFactory = defaultGoogleDriveStoreFactory,
    private readonly controller: GoogleDriveController = new NodeGoogleDriveController()
  ) {}

  private async getStore(): Promise<GoogleDriveStore> {
    if (typeof this.storeOrFactory === 'function') {
      return this.storeOrFactory();
    }

    return this.storeOrFactory;
  }

  private async readTokenCacheMeta(tokenCachePath: string): Promise<GoogleDriveCachedToken | null> {
    try {
      const raw = await readFileAsync(tokenCachePath, 'utf-8');
      return JSON.parse(raw) as GoogleDriveCachedToken;
    } catch {
      return null;
    }
  }

  private async resolveTokenCacheDir(): Promise<string> {
    const { ensureDirectory, getDataPath } = await import('@process/utils');
    const dir = path.join(getDataPath(), 'store', 'connectors', 'google-drive', 'oauth');
    ensureDirectory(dir);
    return dir;
  }

  private async executeSidecar(args: string[]): Promise<string> {
    const config = await this.getConfig();
    const tokenCacheDir = await this.resolveTokenCacheDir();
    const baseArgs = [
      ...config.args,
      '--client-id',
      config.clientId,
      '--client-secret',
      config.clientSecret,
      '--scopes',
      config.scopes.join(','),
      '--token-cache-dir',
      tokenCacheDir,
    ];
    const command = config.command.trim() || 'go';
    const cwd =
      command === 'go' ? path.join(process.cwd(), 'resources', 'native', 'google-drive-sidecar-go') : process.cwd();
    const { stdout } = await execFile(command, [...baseArgs, ...args], {
      cwd,
      windowsHide: true,
      timeout: 30_000,
      env: resolveDefaultLocalProxyEnv(),
    });
    return stdout;
  }

  async getConfig(): Promise<GoogleDriveConnectorConfig> {
    const store = await this.getStore();
    const stored = await store.get(GOOGLE_DRIVE_CONNECTOR_CONFIG_KEY);
    return normalizeGoogleDriveConnectorConfig(stored ?? undefined);
  }

  async setConfig(updates: Partial<GoogleDriveConnectorConfig>): Promise<GoogleDriveConnectorConfig> {
    const current = await this.getConfig();
    const next = normalizeGoogleDriveConnectorConfig({
      ...current,
      ...updates,
    });
    const store = await this.getStore();
    await store.set(GOOGLE_DRIVE_CONNECTOR_CONFIG_KEY, next);
    return next;
  }

  async getStatus(): Promise<GoogleDriveConnectorRuntimeStatus> {
    const config = await this.getConfig();
    const details = this.controller.getRuntimeDetails();
    const hasCredentials = Boolean(config.clientId && config.clientSecret);
    const tokenCacheDir = await this.resolveTokenCacheDir();
    const tokenCachePath = path.join(tokenCacheDir, 'google-drive-token.json');
    const tokenMeta = existsSync(tokenCachePath) ? await this.readTokenCacheMeta(tokenCachePath) : null;

    return {
      ...this.state,
      lifecycle: details.running ? 'running' : this.state.desiredState === 'running' ? 'error' : this.state.lifecycle,
      hasCredentials,
      command: details.command,
      args: details.args,
      pid: details.pid,
      tokenCachePath,
      hasCachedToken: existsSync(tokenCachePath),
      hasRefreshToken: Boolean(tokenMeta?.refresh_token),
      tokenExpiry: tokenMeta?.expiry,
      tokenScope: tokenMeta?.scope,
      lastError: details.lastError ?? this.state.lastError,
      note: details.running ? 'Managed Google Drive sidecar is running.' : this.state.note,
    };
  }

  async createAuthRequest(): Promise<GoogleDriveAuthRequest> {
    const state = `contextgo-google-drive-${Date.now()}`;
    const output = await this.executeSidecar(['--print-auth-url', '--state', state]);
    const payload = JSON.parse(output) as {
      auth_url?: string;
      state?: string;
      redirect_uri?: string;
      token_cache_path?: string;
    };
    return {
      authUrl: payload.auth_url || '',
      state: payload.state || state,
      redirectUri: payload.redirect_uri || '',
      tokenCachePath: payload.token_cache_path || '',
    };
  }

  async completeAuth(params: { callbackUrl?: string; code?: string; state?: string }): Promise<GoogleDriveAuthResult> {
    const args: string[] = [];
    if (params.callbackUrl?.trim()) {
      args.push('--exchange-callback-url', params.callbackUrl.trim());
    } else if (params.code?.trim()) {
      args.push('--exchange-code', params.code.trim());
    } else {
      throw new Error('Google Drive auth completion requires a callback URL or auth code.');
    }
    if (params.state?.trim()) {
      args.push('--state', params.state.trim());
    }
    const output = await this.executeSidecar(args);
    const payload = JSON.parse(output) as { token_cache_path?: string; scope_count?: number };
    return {
      tokenCachePath: payload.token_cache_path || '',
      scopeCount: payload.scope_count || 0,
    };
  }

  async listFiles(limit = 20): Promise<readonly GoogleDriveFile[]> {
    const output = await this.executeSidecar(['--list-files-json', '--limit', String(Math.max(1, limit))]);
    const payload = JSON.parse(output) as { files?: Array<Record<string, unknown>> };
    const files = Array.isArray(payload.files) ? payload.files : [];
    return files.map((file) => ({
      id: String(file.id || ''),
      name: String(file.name || ''),
      mimeType: String(file.mimeType || file.mime_type || ''),
      modifiedTime: typeof file.modifiedTime === 'string' ? file.modifiedTime : undefined,
      createdTime: typeof file.createdTime === 'string' ? file.createdTime : undefined,
      modifiedByMeTime: typeof file.modifiedByMeTime === 'string' ? file.modifiedByMeTime : undefined,
      webViewLink: typeof file.webViewLink === 'string' ? file.webViewLink : undefined,
      iconLink: typeof file.iconLink === 'string' ? file.iconLink : undefined,
      driveId: typeof file.driveId === 'string' ? file.driveId : undefined,
      parents: Array.isArray(file.parents) ? file.parents.map((value) => String(value)) : undefined,
      ownerNames: Array.isArray(file.ownerNames) ? file.ownerNames.map((value) => String(value)) : undefined,
      sizeBytes: typeof file.sizeBytes === 'number' ? file.sizeBytes : undefined,
      shared: typeof file.shared === 'boolean' ? file.shared : undefined,
      starred: typeof file.starred === 'boolean' ? file.starred : undefined,
      trashed: typeof file.trashed === 'boolean' ? file.trashed : undefined,
    }));
  }

  async start(): Promise<GoogleDriveConnectorRuntimeStatus> {
    const config = await this.getConfig();
    const now = Date.now();

    if (!config.clientId || !config.clientSecret) {
      this.state = {
        ...this.state,
        lifecycle: 'error',
        desiredState: 'running',
        hasCredentials: false,
        lastError: 'Google Drive connector requires Client ID and Client Secret before launch.',
        note: 'Google Drive connector requires Client ID and Client Secret before launch.',
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

  async stop(): Promise<GoogleDriveConnectorRuntimeStatus> {
    await this.controller.stop();
    this.state = {
      ...this.state,
      lifecycle: 'stopped',
      desiredState: 'stopped',
      pid: undefined,
      lastError: undefined,
      note: 'Managed Google Drive sidecar is stopped.',
      lastStopAt: Date.now(),
    };
    return this.getStatus();
  }
}
