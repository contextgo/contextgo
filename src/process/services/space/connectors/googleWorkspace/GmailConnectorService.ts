import { existsSync } from 'node:fs';
import { readFile as readFileAsync } from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import type { IConfigStorageRefer } from '@/common/config/storage';
import type { GmailConnectorConfig, GmailConnectorRuntimeStatus, GmailMessage } from '@/common/types/connectors/gmail';
import { resolveDefaultLocalProxyEnv } from '../googleDrive/GoogleDriveController.ts';
import { NodeGoogleDocsController } from '../googleDocs/GoogleDocsController.ts';
import { resolveGoogleWorkspaceOAuthDir } from './shared.ts';

const execFile = promisify(execFileCallback);
const KEY = 'connector.gmail.config';
const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
type StoreRef = Pick<IConfigStorageRefer, 'connector.gmail.config'>;
type Store = {
  get<K extends keyof StoreRef>(key: K): Promise<StoreRef[K]>;
  set<K extends keyof StoreRef>(key: K, value: StoreRef[K]): Promise<StoreRef[K]>;
};
type StoreFactory = () => Promise<Store>;
type TokenMeta = { refresh_token?: string; expiry?: string; scope?: string };
const defaultStoreFactory: StoreFactory = async () => (await import('@process/utils/initStorage')).ProcessConfig;
const normalizeScopes = (scopes?: string[]) =>
  Array.isArray(scopes) && scopes.length ? scopes.map((s) => s.trim()).filter(Boolean) : [...DEFAULT_SCOPES];
export const normalizeGmailConnectorConfig = (input?: Partial<GmailConnectorConfig> | null): GmailConnectorConfig => ({
  enabled: input?.enabled ?? false,
  clientId: input?.clientId?.trim() ?? '',
  clientSecret: input?.clientSecret?.trim() ?? '',
  scopes: normalizeScopes(input?.scopes),
  command: input?.command?.trim() || 'go',
  args: Array.isArray(input?.args) && input.args.length ? [...input.args] : ['run', '.'],
});
export class GmailConnectorService {
  private state: GmailConnectorRuntimeStatus = {
    lifecycle: 'stopped',
    desiredState: 'stopped',
    available: true,
    note: 'Gmail connector reuses Google Workspace OAuth and a managed Go sidecar.',
    hasCredentials: false,
  };
  constructor(
    private readonly storeOrFactory: Store | StoreFactory = defaultStoreFactory,
    private readonly controller = new NodeGoogleDocsController()
  ) {}
  private async getStore(): Promise<Store> {
    return typeof this.storeOrFactory === 'function' ? this.storeOrFactory() : this.storeOrFactory;
  }
  private async readTokenMeta(tokenCachePath: string): Promise<TokenMeta | null> {
    try {
      return JSON.parse(await readFileAsync(tokenCachePath, 'utf-8')) as TokenMeta;
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
    const { stdout } = await execFile(
      command,
      [
        ...config.args,
        '--client-id',
        config.clientId,
        '--client-secret',
        config.clientSecret,
        '--scopes',
        config.scopes.join(','),
        '--token-cache-dir',
        tokenCacheDir,
        ...args,
      ],
      { cwd, windowsHide: true, timeout: 30000, env: resolveDefaultLocalProxyEnv() }
    );
    return stdout;
  }
  async getConfig(): Promise<GmailConnectorConfig> {
    const stored = await (await this.getStore()).get(KEY);
    return normalizeGmailConnectorConfig(stored ?? undefined);
  }
  async setConfig(updates: Partial<GmailConnectorConfig>): Promise<GmailConnectorConfig> {
    const next = normalizeGmailConnectorConfig({ ...(await this.getConfig()), ...updates });
    await (await this.getStore()).set(KEY, next);
    return next;
  }
  async getStatus(): Promise<GmailConnectorRuntimeStatus> {
    const config = await this.getConfig();
    const details = this.controller.getRuntimeDetails();
    const tokenCachePath = path.join(await resolveGoogleWorkspaceOAuthDir(), 'google-drive-token.json');
    const tokenMeta = existsSync(tokenCachePath) ? await this.readTokenMeta(tokenCachePath) : null;
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
      note: details.running ? 'Managed Gmail sidecar is running.' : this.state.note,
    };
  }
  async start(): Promise<GmailConnectorRuntimeStatus> {
    const config = await this.getConfig();
    const now = Date.now();
    if (!config.clientId || !config.clientSecret) {
      this.state = {
        ...this.state,
        lifecycle: 'error',
        desiredState: 'running',
        hasCredentials: false,
        note: 'Gmail connector requires Client ID and Client Secret before launch.',
        lastError: 'Gmail connector requires Client ID and Client Secret before launch.',
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
  async stop(): Promise<GmailConnectorRuntimeStatus> {
    await this.controller.stop();
    this.state = {
      ...this.state,
      lifecycle: 'stopped',
      desiredState: 'stopped',
      pid: undefined,
      note: 'Managed Gmail sidecar is stopped.',
      lastStopAt: Date.now(),
      lastError: undefined,
    };
    return this.getStatus();
  }
  async listMessages(limit = 20): Promise<readonly GmailMessage[]> {
    const payload = JSON.parse(
      await this.executeSidecar(['--list-gmail-messages-json', '--limit', String(Math.max(1, limit))])
    ) as { messages?: Array<Record<string, unknown>> };
    return (Array.isArray(payload.messages) ? payload.messages : []).map((message) => ({
      id: String(message.id || ''),
      threadId: typeof message.threadId === 'string' ? message.threadId : undefined,
      subject: typeof message.subject === 'string' ? message.subject : undefined,
      from: typeof message.from === 'string' ? message.from : undefined,
      snippet: typeof message.snippet === 'string' ? message.snippet : undefined,
      internalDate: typeof message.internalDate === 'string' ? message.internalDate : undefined,
      labelIds: Array.isArray(message.labelIds) ? message.labelIds.map((value) => String(value)) : undefined,
    }));
  }
}
