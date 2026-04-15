/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import { webui } from '@/common/adapter/ipcBridge';
import { cleanupWebAdapter } from '@process/webserver/adapter';
import { startWebServerWithInstance, type WebServerInstance } from '@process/webserver';

export type HostBrowserEntryDemand = 'local-client' | 'official-remote';
export type HostBrowserEntryLifecycle = 'stopped' | 'starting' | 'running' | 'stopping' | 'degraded';

export type HostBrowserEntryRequest = {
  preferredPort: number;
  allowRemote: boolean;
  reason: string;
  allowPortFallback?: boolean;
};

export type HostBrowserEntryRuntimeStatus = {
  lifecycle: HostBrowserEntryLifecycle;
  running: boolean;
  port: number | null;
  allowRemote: boolean;
  localUrl?: string;
  networkUrl?: string;
  demandSources: HostBrowserEntryDemand[];
};

export type HostBrowserEntryDemandState = {
  active: boolean;
  allowRemote: boolean;
  preferredPort: number | null;
  allowPortFallback: boolean;
};

const OFFICIAL_REMOTE_PORT_FALLBACK_ATTEMPTS = 10;

const isPortInUseError = (error: unknown): error is NodeJS.ErrnoException => {
  return error instanceof Error && 'code' in error && error.code === 'EADDRINUSE';
};

const buildPortCandidates = (preferredPort: number, maxAttempts: number): number[] => {
  const candidates = [preferredPort];

  for (let offset = 1; offset <= maxAttempts; offset += 1) {
    const candidate = preferredPort + offset;
    if (candidate > 65535) {
      break;
    }
    candidates.push(candidate);
  }

  return candidates;
};

const getNetworkUrl = (port: number, allowRemote: boolean): string | undefined => {
  if (!allowRemote) {
    return undefined;
  }

  const nets = require('node:os').networkInterfaces() as ReturnType<typeof import('node:os').networkInterfaces>;
  for (const name of Object.keys(nets)) {
    const netInfo = nets[name];
    if (!netInfo) {
      continue;
    }

    for (const net of netInfo) {
      const isIPv4 = net.family === 'IPv4' || (net.family as unknown) === 4;
      if (isIPv4 && !net.internal) {
        return `http://${net.address}:${port}`;
      }
    }
  }

  return undefined;
};

export class HostBrowserEntryService {
  private currentInstance: WebServerInstance | null = null;
  private startupPromise: Promise<WebServerInstance> | null = null;
  private readonly demandRequests = new Map<HostBrowserEntryDemand, HostBrowserEntryRequest>();
  private lifecycle: HostBrowserEntryLifecycle = 'stopped';

  public getCurrentInstance(): WebServerInstance | null {
    return this.currentInstance;
  }

  public setCurrentInstanceForLegacy(instance: WebServerInstance | null): void {
    this.currentInstance = instance;
  }

  public getLocalBaseUrl(): string | null {
    if (!this.currentInstance) {
      return null;
    }
    return `http://localhost:${this.currentInstance.port}`;
  }

  public getRuntimeStatus(): HostBrowserEntryRuntimeStatus {
    return {
      lifecycle: this.lifecycle,
      running: this.currentInstance !== null,
      port: this.currentInstance?.port ?? null,
      allowRemote: this.currentInstance?.allowRemote ?? false,
      localUrl: this.currentInstance ? `http://localhost:${this.currentInstance.port}` : undefined,
      networkUrl: this.currentInstance
        ? getNetworkUrl(this.currentInstance.port, this.currentInstance.allowRemote)
        : undefined,
      demandSources: Array.from(this.demandRequests.keys()).toSorted((left, right) => left.localeCompare(right)),
    };
  }

  public getDemandState(demand: HostBrowserEntryDemand): HostBrowserEntryDemandState {
    const request = this.demandRequests.get(demand);
    if (!request) {
      return {
        active: false,
        allowRemote: false,
        preferredPort: null,
        allowPortFallback: false,
      };
    }

    return {
      active: true,
      allowRemote: request.allowRemote,
      preferredPort: request.preferredPort,
      allowPortFallback: request.allowPortFallback === true,
    };
  }

  public async ensureForDemand(
    demand: HostBrowserEntryDemand,
    request: HostBrowserEntryRequest
  ): Promise<WebServerInstance> {
    this.demandRequests.set(demand, request);
    if (!this.currentInstance && !this.startupPromise) {
      this.lifecycle = 'starting';
      this.emitRuntimeStatus();
    }
    await app.whenReady();
    return this.reconcile(`ensure:${request.reason}`);
  }

  public async releaseDemand(demand: HostBrowserEntryDemand, reason: string): Promise<void> {
    this.demandRequests.delete(demand);
    if (this.demandRequests.size > 0) {
      return;
    }
    if (this.currentInstance) {
      this.lifecycle = 'stopping';
      this.emitRuntimeStatus(this.currentInstance);
    } else if (!this.startupPromise) {
      this.lifecycle = 'stopped';
      this.emitRuntimeStatus();
    }
    await app.whenReady();
    if (!this.currentInstance) {
      this.lifecycle = 'stopped';
      this.emitRuntimeStatus();
      return;
    }
    await this.stopCurrentInstance(reason);
  }

  private async reconcile(reason: string): Promise<WebServerInstance> {
    const activeRequests = Array.from(this.demandRequests.values());
    if (activeRequests.length === 0) {
      throw new Error(`[HostBrowserEntry] No active demand to reconcile (${reason})`);
    }

    const latestRequest = activeRequests[activeRequests.length - 1];
    const allowRemote = activeRequests.some((request) => request.allowRemote);
    const allowPortFallback = activeRequests.some((request) => request.allowPortFallback === true);

    if (this.currentInstance && this.currentInstance.allowRemote === allowRemote) {
      return this.currentInstance;
    }

    if (this.currentInstance) {
      await this.stopCurrentInstance(`${reason}:reconfigure`);
    }

    return this.startOnce(latestRequest.preferredPort, allowRemote, latestRequest.reason, allowPortFallback);
  }

  private async startOnce(
    preferredPort: number,
    allowRemote: boolean,
    reason: string,
    allowPortFallback: boolean
  ): Promise<WebServerInstance> {
    if (this.currentInstance && Number.isFinite(this.currentInstance.port) && this.currentInstance.port > 0) {
      return this.currentInstance;
    }

    if (this.startupPromise) {
      return this.startupPromise;
    }

    this.lifecycle = 'starting';
    this.emitRuntimeStatus();
    this.startupPromise = (async () => {
      const candidatePorts = allowPortFallback
        ? buildPortCandidates(preferredPort, OFFICIAL_REMOTE_PORT_FALLBACK_ATTEMPTS)
        : [preferredPort];

      const instance = await this.startOnCandidatePorts(candidatePorts, preferredPort, allowRemote, reason);
      this.currentInstance = instance;
      this.lifecycle = 'running';
      this.emitRuntimeStatus(instance);
      return instance;
    })()
      .catch((error) => {
        this.lifecycle = this.demandRequests.size > 0 ? 'degraded' : 'stopped';
        this.emitRuntimeStatus();
        throw error;
      })
      .finally(() => {
        this.startupPromise = null;
      });

    return this.startupPromise;
  }

  private async startOnCandidatePorts(
    candidatePorts: number[],
    preferredPort: number,
    allowRemote: boolean,
    reason: string
  ): Promise<WebServerInstance> {
    const [candidatePort, ...remainingPorts] = candidatePorts;

    if (candidatePort === undefined) {
      throw new Error(`[HostBrowserEntry] Failed to start browser entry for ${reason}`);
    }

    try {
      const instance = await startWebServerWithInstance(candidatePort, allowRemote);
      if (candidatePort !== preferredPort) {
        console.warn(
          `[HostBrowserEntry] Preferred port ${preferredPort} was occupied; ${reason} is using fallback port ${candidatePort}`
        );
      }
      return instance;
    } catch (error) {
      if (!isPortInUseError(error) || remainingPorts.length === 0) {
        throw error;
      }
      return this.startOnCandidatePorts(remainingPorts, preferredPort, allowRemote, reason);
    }
  }

  private async stopCurrentInstance(reason: string): Promise<void> {
    if (!this.currentInstance) {
      return;
    }

    this.lifecycle = 'stopping';
    this.emitRuntimeStatus(this.currentInstance);
    try {
      const { server, wss } = this.currentInstance;
      wss.clients.forEach((client) => client.close(1000, reason));
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        setTimeout(resolve, 2000);
      });
      cleanupWebAdapter();
    } catch (error) {
      console.warn(`[HostBrowserEntry] Failed to stop browser entry (${reason}):`, error);
    }

    this.currentInstance = null;
    this.lifecycle = 'stopped';
    this.emitRuntimeStatus();
  }

  private emitRuntimeStatus(instance?: WebServerInstance | null): void {
    const runtimeInstance = instance ?? this.currentInstance;
    webui.statusChanged.emit({
      lifecycle: this.lifecycle,
      running: runtimeInstance !== null,
      port: runtimeInstance?.port,
      localUrl: runtimeInstance ? `http://localhost:${runtimeInstance.port}` : undefined,
      networkUrl: runtimeInstance ? getNetworkUrl(runtimeInstance.port, runtimeInstance.allowRemote) : undefined,
    });
  }
}

let hostBrowserEntryService: HostBrowserEntryService | null = null;

export const getHostBrowserEntryService = (): HostBrowserEntryService => {
  if (!hostBrowserEntryService) {
    hostBrowserEntryService = new HostBrowserEntryService();
  }
  return hostBrowserEntryService;
};

export const resetHostBrowserEntryServiceForTests = (): void => {
  hostBrowserEntryService = null;
};
