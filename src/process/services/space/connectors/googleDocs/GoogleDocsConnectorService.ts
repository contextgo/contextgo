import { existsSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { IConfigStorageRefer } from '@/common/config/storage';
import type {
  GoogleDoc,
  GoogleDocsConnectorConfig,
  GoogleDocsConnectorRuntimeStatus,
} from '@/common/types/connectors/googleDocs';
import { resolveDefaultLocalProxyEnv } from '../googleDrive/GoogleDriveController.ts';
import { NodeGoogleDocsController } from './GoogleDocsController.ts';
import { resolveGoogleWorkspaceOAuthDir } from '../googleWorkspace/shared.ts';

const execFile = promisify(execFileCallback);
const GOOGLE_DOCS_CONNECTOR_CONFIG_KEY = 'connector.googleDocs.config';
const DEFAULT_GOOGLE_DOCS_SCOPES = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
];

type GoogleDocsConfigStore = Pick<IConfigStorageRefer, 'connector.googleDocs.config'>;

type GoogleDocsStore = {
  get<K extends keyof GoogleDocsConfigStore>(key: K): Promise<GoogleDocsConfigStore[K]>;
  set<K extends keyof GoogleDocsConfigStore>(
    key: K,
    value: GoogleDocsConfigStore[K]
  ): Promise<GoogleDocsConfigStore[K]>;
};

type GoogleDocsStoreFactory = () => Promise<GoogleDocsStore>;

type GoogleDocsCachedToken = {
  refresh_token?: string;
  expiry?: string;
  scope?: string;
};

const defaultGoogleDocsStoreFactory: GoogleDocsStoreFactory = async () => {
  const { ProcessConfig } = await import('@process/utils/initStorage');
  return ProcessConfig;
};

const normalizeScopes = (scopes?: string[]): string[] => {
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return [...DEFAULT_GOOGLE_DOCS_SCOPES];
  }
  return scopes.map((scope) => scope.trim()).filter(Boolean);
};

export const normalizeGoogleDocsConnectorConfig = (
  input?: Partial<GoogleDocsConnectorConfig> | null
): GoogleDocsConnectorConfig => ({
  enabled: input?.enabled ?? false,
  clientId: input?.clientId?.trim() ?? '',
  clientSecret: input?.clientSecret?.trim() ?? '',
  scopes: normalizeScopes(input?.scopes),
  command: input?.command?.trim() || 'go',
  args: Array.isArray(input?.args) && input.args.length > 0 ? [...input.args] : ['run', '.'],
});

export class GoogleDocsConnectorService {
  private state: GoogleDocsConnectorRuntimeStatus = {
    lifecycle: 'stopped',
    desiredState: 'stopped',
    available: true,
    note: 'Google Docs connector reuses Google Workspace OAuth and a managed Go sidecar.',
    hasCredentials: false,
  };

  constructor(
    private readonly storeOrFactory: GoogleDocsStore | GoogleDocsStoreFactory = defaultGoogleDocsStoreFactory,
    private readonly controller = new NodeGoogleDocsController()
  ) {}

  private async getStore(): Promise<GoogleDocsStore> {
    if (typeof this.storeOrFactory === 'function') {
      return this.storeOrFactory();
    }
    return this.storeOrFactory;
  }

  private async readTokenCacheMeta(tokenCachePath: string): Promise<GoogleDocsCachedToken | null> {
    try {
      const raw = await readFileAsync(tokenCachePath, 'utf-8');
      return JSON.parse(raw) as GoogleDocsCachedToken;
    } catch {
      return null;
    }
  }

  private async executeSidecar(args: string[]): Promise<string> {
    const config = await this.getConfig();
    const tokenCacheDir = await resolveGoogleWorkspaceOAuthDir();
    const command = config.command.trim() || 'go';
    const cwd =
      command === 'go' ? path.join(process.cwd(), 'resources', 'native', 'google-drive-sidecar-go') : process.cwd();
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
    const { stdout } = await execFile(command, [...baseArgs, ...args], {
      cwd,
      windowsHide: true,
      timeout: 30_000,
      env: resolveDefaultLocalProxyEnv(),
    });
    return stdout;
  }

  async getConfig(): Promise<GoogleDocsConnectorConfig> {
    const store = await this.getStore();
    const stored = await store.get(GOOGLE_DOCS_CONNECTOR_CONFIG_KEY);
    return normalizeGoogleDocsConnectorConfig(stored ?? undefined);
  }

  async setConfig(updates: Partial<GoogleDocsConnectorConfig>): Promise<GoogleDocsConnectorConfig> {
    const current = await this.getConfig();
    const next = normalizeGoogleDocsConnectorConfig({ ...current, ...updates });
    const store = await this.getStore();
    await store.set(GOOGLE_DOCS_CONNECTOR_CONFIG_KEY, next);
    return next;
  }

  async getStatus(): Promise<GoogleDocsConnectorRuntimeStatus> {
    const config = await this.getConfig();
    const details = this.controller.getRuntimeDetails();
    const tokenCacheDir = await resolveGoogleWorkspaceOAuthDir();
    const tokenCachePath = path.join(tokenCacheDir, 'google-drive-token.json');
    const tokenMeta = existsSync(tokenCachePath) ? await this.readTokenCacheMeta(tokenCachePath) : null;
    return {
      ...this.state,
      lifecycle: details.running ? 'running' : this.state.desiredState === 'running' ? 'error' : this.state.lifecycle,
      hasCredentials: Boolean(config.clientId && config.clientSecret),
      command: details.command,
      args: details.args,
      pid: details.pid,
      tokenCachePath,
      hasCachedToken: existsSync(tokenCachePath),
      hasRefreshToken: Boolean(tokenMeta?.refresh_token),
      tokenExpiry: tokenMeta?.expiry,
      tokenScope: tokenMeta?.scope,
      lastError: details.lastError ?? this.state.lastError,
      note: details.running ? 'Managed Google Docs sidecar is running.' : this.state.note,
    };
  }

  async start(): Promise<GoogleDocsConnectorRuntimeStatus> {
    const config = await this.getConfig();
    const now = Date.now();
    if (!config.clientId || !config.clientSecret) {
      this.state = {
        ...this.state,
        lifecycle: 'error',
        desiredState: 'running',
        hasCredentials: false,
        lastError: 'Google Docs connector requires Client ID and Client Secret before launch.',
        note: 'Google Docs connector requires Client ID and Client Secret before launch.',
        lastStartAt: now,
      };
      return this.getStatus();
    }
    const result = await this.controller.start(config);
    this.state = {
      ...this.state,
      lifecycle: 'running',
      desiredState: 'running',
      hasCredentials: true,
      command: result.command,
      args: result.args,
      pid: result.pid,
      note: result.note,
      lastStartAt: now,
      lastError: undefined,
    };
    return this.getStatus();
  }

  async stop(): Promise<GoogleDocsConnectorRuntimeStatus> {
    await this.controller.stop();
    this.state = {
      ...this.state,
      lifecycle: 'stopped',
      desiredState: 'stopped',
      pid: undefined,
      note: 'Managed Google Docs sidecar is stopped.',
      lastStopAt: Date.now(),
      lastError: undefined,
    };
    return this.getStatus();
  }

  async listDocuments(limit = 20): Promise<readonly GoogleDoc[]> {
    const output = await this.executeSidecar(['--list-docs-json', '--limit', String(Math.max(1, limit))]);
    const payload = JSON.parse(output) as { files?: Array<Record<string, unknown>> };
    const files = Array.isArray(payload.files) ? payload.files : [];
    return files.map((file) => ({
      id: String(file.id || ''),
      title: String(file.name || file.title || ''),
      mimeType: String(file.mimeType || ''),
      modifiedTime: typeof file.modifiedTime === 'string' ? file.modifiedTime : undefined,
      createdTime: typeof file.createdTime === 'string' ? file.createdTime : undefined,
      webViewLink: typeof file.webViewLink === 'string' ? file.webViewLink : undefined,
      ownerNames: Array.isArray(file.ownerNames) ? file.ownerNames.map((value) => String(value)) : undefined,
      sizeBytes: typeof file.sizeBytes === 'number' ? file.sizeBytes : undefined,
      starred: typeof file.starred === 'boolean' ? file.starred : undefined,
      trashed: typeof file.trashed === 'boolean' ? file.trashed : undefined,
    }));
  }
}
