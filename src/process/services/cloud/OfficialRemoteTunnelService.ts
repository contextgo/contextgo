/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { ipcBridge } from '@/common';
import { SERVER_CONFIG } from '@process/webserver/config/constants';
import { startWebServerWithInstance } from '@process/webserver';
import { ProcessConfig } from '@process/utils/initStorage';
import { getWebServerInstance, setWebServerInstance } from '@process/bridge/webuiBridge';
import { WebuiService } from '@process/bridge/services/WebuiService';
import {
  buildManagedFrpClientConfig,
  getDefaultOfficialRemoteFrpConfigPath,
  parseFrpClientConfig,
} from './officialRemoteConfig';

const CLOUD_DEVICE_TOKEN_KEY = 'cloud.deviceToken';
const DESKTOP_WEBUI_ENABLED_KEY = 'webui.desktop.enabled';
const DESKTOP_WEBUI_ALLOW_REMOTE_KEY = 'webui.desktop.allowRemote';
const DESKTOP_WEBUI_PORT_KEY = 'webui.desktop.port';
const OFFICIAL_REMOTE_RETRY_DELAY_MS = 3_000;
const OFFICIAL_REMOTE_RECONCILE_INTERVAL_MS = 15_000;

type WebServerInstance = NonNullable<ReturnType<typeof getWebServerInstance>>;

type OfficialRemoteTunnelState = {
  desired: boolean;
  running: boolean;
  localPort?: number;
  remotePort?: number;
  configPath?: string;
  managedConfigPath?: string;
  binaryPath?: string;
  message?: string;
};

function getExecutableCandidates(): string[] {
  const fromEnv = [process.env.CONTEXTGO_FRPC_PATH, process.env.FRPC_PATH].filter((value): value is string =>
    Boolean(value?.trim())
  );

  const localCandidates = process.platform === 'win32' ? ['frpc.exe', 'frpc'] : ['frpc'];

  return [
    ...fromEnv,
    ...localCandidates,
    '/opt/homebrew/bin/frpc',
    '/opt/homebrew/opt/frpc/bin/frpc',
    '/usr/local/bin/frpc',
    path.join(app.getPath('home'), '.local', 'bin', 'frpc'),
  ];
}

async function isExecutable(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveExecutableFromPath(command: string): Promise<string | null> {
  if (path.isAbsolute(command)) {
    return (await isExecutable(command)) ? command : null;
  }

  const searchPaths = (process.env.PATH || '')
    .split(path.delimiter)
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const searchPath of searchPaths) {
    const candidate = path.join(searchPath, command);
    if (await isExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function resolveFrpcBinaryPath(): Promise<string | null> {
  for (const candidate of getExecutableCandidates()) {
    const resolvedPath = await resolveExecutableFromPath(candidate);
    if (resolvedPath) {
      return resolvedPath;
    }
  }

  return null;
}

async function stopChildProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.killed || child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finalize = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const timeoutId = setTimeout(() => {
      child.kill('SIGKILL');
      finalize();
    }, 2_000);

    child.once('exit', () => {
      clearTimeout(timeoutId);
      finalize();
    });

    child.kill('SIGTERM');
  });
}

export class OfficialRemoteTunnelService {
  private static instance: OfficialRemoteTunnelService | null = null;

  public static getInstance(): OfficialRemoteTunnelService {
    if (!OfficialRemoteTunnelService.instance) {
      OfficialRemoteTunnelService.instance = new OfficialRemoteTunnelService();
    }

    return OfficialRemoteTunnelService.instance;
  }

  private initialized = false;
  private reconcileInFlight = false;
  private reconcileQueued = false;
  private child: ChildProcessWithoutNullStreams | null = null;
  private activeSignature: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private statusChangedCallback: (() => void) | null = null;
  private state: OfficialRemoteTunnelState = {
    desired: false,
    running: false,
  };

  public initialize(statusChangedCallback?: () => void): void {
    if (statusChangedCallback) {
      this.statusChangedCallback = statusChangedCallback;
    }

    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.intervalTimer = setInterval(() => {
      void this.reconcile('periodic');
    }, OFFICIAL_REMOTE_RECONCILE_INTERVAL_MS);
  }

  public async reconcile(reason: string): Promise<void> {
    if (this.reconcileInFlight) {
      this.reconcileQueued = true;
      return;
    }

    this.reconcileInFlight = true;
    try {
      await this.reconcileInternal(reason);
    } finally {
      this.reconcileInFlight = false;
      if (this.reconcileQueued) {
        this.reconcileQueued = false;
        void this.reconcile(`${reason}:queued`);
      }
    }
  }

  public async dispose(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    const currentChild = this.child;
    this.child = null;
    this.activeSignature = null;
    if (currentChild) {
      await stopChildProcess(currentChild);
    }
  }

  public getState(): OfficialRemoteTunnelState {
    return { ...this.state };
  }

  private async reconcileInternal(_reason: string): Promise<void> {
    const [deviceToken, webuiEnabled] = await Promise.all([
      ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY),
      ProcessConfig.get(DESKTOP_WEBUI_ENABLED_KEY),
    ]);

    const desired = Boolean(deviceToken) && webuiEnabled === true;
    if (!desired) {
      this.updateState({
        desired: false,
        running: false,
        message: deviceToken ? 'Official Remote is paused because WebUI is disabled.' : undefined,
      });
      await this.stopTunnel();
      return;
    }

    const webuiInstance = await this.ensureWebUiRunning();
    const sourceConfigPath = process.env.CONTEXTGO_FRPC_CONFIG_PATH || getDefaultOfficialRemoteFrpConfigPath();
    const sourceConfigRaw = await fs.readFile(sourceConfigPath, 'utf-8').catch((): null => null);
    if (!sourceConfigRaw) {
      this.updateState({
        desired: true,
        running: false,
        localPort: webuiInstance.port,
        configPath: sourceConfigPath,
        message: `Official Remote FRP config was not found at ${sourceConfigPath}.`,
      });
      await this.stopTunnel();
      return;
    }

    const parsedConfig = parseFrpClientConfig(sourceConfigRaw);
    if (!parsedConfig) {
      this.updateState({
        desired: true,
        running: false,
        localPort: webuiInstance.port,
        configPath: sourceConfigPath,
        message: `Official Remote FRP config is invalid: ${sourceConfigPath}.`,
      });
      await this.stopTunnel();
      return;
    }

    const binaryPath = await resolveFrpcBinaryPath();
    if (!binaryPath) {
      this.updateState({
        desired: true,
        running: false,
        localPort: webuiInstance.port,
        remotePort: parsedConfig.proxy.remotePort,
        configPath: sourceConfigPath,
        message: 'frpc is not installed. Install frpc or set CONTEXTGO_FRPC_PATH.',
      });
      await this.stopTunnel();
      return;
    }

    const managedConfigDir = path.join(app.getPath('userData'), 'official-remote');
    const managedConfigPath = path.join(managedConfigDir, 'frpc.managed.toml');
    await fs.mkdir(managedConfigDir, { recursive: true });
    await fs.writeFile(
      managedConfigPath,
      buildManagedFrpClientConfig(parsedConfig, {
        localIP: '127.0.0.1',
        localPort: webuiInstance.port,
      }),
      'utf-8'
    );

    const nextSignature = `${binaryPath}|${managedConfigPath}|${webuiInstance.port}|${parsedConfig.proxy.remotePort}`;
    if (this.child && this.activeSignature === nextSignature && this.child.exitCode === null) {
      this.updateState({
        desired: true,
        running: true,
        localPort: webuiInstance.port,
        remotePort: parsedConfig.proxy.remotePort,
        configPath: sourceConfigPath,
        managedConfigPath,
        binaryPath,
        message: undefined,
      });
      return;
    }

    await this.stopTunnel();
    this.startTunnel(
      binaryPath,
      managedConfigPath,
      sourceConfigPath,
      webuiInstance.port,
      parsedConfig.proxy.remotePort
    );
  }

  private async ensureWebUiRunning(): Promise<WebServerInstance> {
    const currentInstance = getWebServerInstance();
    if (currentInstance) {
      return currentInstance;
    }

    const [allowRemotePref, portPref] = await Promise.all([
      ProcessConfig.get(DESKTOP_WEBUI_ALLOW_REMOTE_KEY),
      ProcessConfig.get(DESKTOP_WEBUI_PORT_KEY),
    ]);

    const allowRemote = allowRemotePref === true;
    const preferredPort = typeof portPref === 'number' && portPref > 0 ? portPref : SERVER_CONFIG.DEFAULT_PORT;
    const instance = await startWebServerWithInstance(preferredPort, allowRemote);
    setWebServerInstance(instance);

    const lanIP = WebuiService.getLanIP();
    const networkUrl = allowRemote && lanIP ? `http://${lanIP}:${instance.port}` : undefined;
    ipcBridge.webui.statusChanged.emit({
      running: true,
      port: instance.port,
      localUrl: `http://localhost:${instance.port}`,
      networkUrl,
    });

    return instance;
  }

  private startTunnel(
    binaryPath: string,
    managedConfigPath: string,
    sourceConfigPath: string,
    localPort: number,
    remotePort: number
  ): void {
    const child = spawn(binaryPath, ['-c', managedConfigPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const signature = `${binaryPath}|${managedConfigPath}|${localPort}|${remotePort}`;
    this.child = child;
    this.activeSignature = signature;

    this.updateState({
      desired: true,
      running: false,
      binaryPath,
      configPath: sourceConfigPath,
      managedConfigPath,
      localPort,
      remotePort,
      message: 'Official Remote tunnel is starting.',
    });

    const handleOutput = (chunk: Buffer, stream: 'stdout' | 'stderr'): void => {
      const text = chunk.toString().trim();
      if (!text) {
        return;
      }
      console.log(`[OfficialRemote][${stream}] ${text}`);
    };

    child.stdout.on('data', (chunk: Buffer) => handleOutput(chunk, 'stdout'));
    child.stderr.on('data', (chunk: Buffer) => handleOutput(chunk, 'stderr'));

    child.once('spawn', () => {
      this.updateState({
        desired: true,
        running: true,
        binaryPath,
        configPath: sourceConfigPath,
        managedConfigPath,
        localPort,
        remotePort,
        message: undefined,
      });
    });

    child.once('error', (error) => {
      console.error('[OfficialRemote] Failed to start frpc:', error);
      if (this.child === child) {
        this.child = null;
        this.activeSignature = null;
      }
      this.updateState({
        desired: true,
        running: false,
        binaryPath,
        configPath: sourceConfigPath,
        managedConfigPath,
        localPort,
        remotePort,
        message: error.message,
      });
      this.scheduleRetry();
    });

    child.once('exit', (code, signal) => {
      if (this.child === child) {
        this.child = null;
        this.activeSignature = null;
      }

      if (!this.state.desired) {
        return;
      }

      const exitReason =
        code !== null ? `frpc exited with code ${code}` : signal ? `frpc exited with signal ${signal}` : 'frpc exited';
      console.warn(`[OfficialRemote] ${exitReason}`);
      this.updateState({
        desired: true,
        running: false,
        binaryPath,
        configPath: sourceConfigPath,
        managedConfigPath,
        localPort,
        remotePort,
        message: exitReason,
      });
      this.scheduleRetry();
    });
  }

  private async stopTunnel(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    const currentChild = this.child;
    this.child = null;
    this.activeSignature = null;

    if (currentChild) {
      await stopChildProcess(currentChild);
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer || !this.state.desired) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.reconcile('retry');
    }, OFFICIAL_REMOTE_RETRY_DELAY_MS);
  }

  private updateState(nextPartialState: Partial<OfficialRemoteTunnelState>): void {
    this.state = {
      ...this.state,
      ...nextPartialState,
    };

    if (this.statusChangedCallback) {
      this.statusChangedCallback();
    }
  }
}

export function getOfficialRemoteTunnelService(): OfficialRemoteTunnelService {
  return OfficialRemoteTunnelService.getInstance();
}
