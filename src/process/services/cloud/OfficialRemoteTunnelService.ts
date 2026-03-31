/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Buffer } from 'node:buffer';
import WebSocket, { type RawData } from 'ws';
import type { OfficialRemoteStatus } from '@/common/types/cloud';
import { getBridgeEmitter, registerWebSocketBroadcaster } from '@/common/adapter/registry';
import { ProcessConfig } from '@process/utils/initStorage';
import { CLOUD_API_BASE_URL } from './constants';

const CLOUD_DEVICE_TOKEN_KEY = 'cloud.deviceToken';
const OFFICIAL_REMOTE_RETRY_DELAY_MS = 3_000;
const OFFICIAL_REMOTE_RECONCILE_INTERVAL_MS = 15_000;
const OFFICIAL_REMOTE_PING_INTERVAL_MS = 20_000;
const OFFICIAL_REMOTE_AUTH_CLOSE_CODES = new Set([4401]);

type OfficialRemoteRelayFrame =
  | { type: 'hello'; deviceId?: string; connectedAt?: string; transport?: string }
  | { type: 'ping'; timestamp?: number }
  | { type: 'pong'; timestamp?: number }
  | { type: 'client_status'; connected?: boolean; connectedAt?: string }
  | { type: 'bridge'; payload?: { name?: string; data?: unknown } };

const DEFAULT_READY_MESSAGE = 'Official Remote is connected through ContextGo Cloud relay.';
const DEFAULT_REAUTH_MESSAGE = 'Official Remote needs a fresh cloud login before this desktop can reconnect.';

export type OfficialRemoteTokenRefreshResult = {
  refreshed: boolean;
  message?: string;
};

export function buildOfficialRemoteRelayWebSocketUrl(apiBaseUrl: string = CLOUD_API_BASE_URL): string {
  const url = new URL('/api/remote/device-connect', apiBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function parseOfficialRemoteRelayFrame(raw: string): OfficialRemoteRelayFrame | null {
  try {
    const parsed = JSON.parse(raw) as OfficialRemoteRelayFrame;
    return parsed && typeof parsed === 'object' && typeof parsed.type === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function rawDataToString(value: RawData): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return Buffer.concat(value.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))).toString('utf-8');
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf-8');
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value).toString('utf-8');
  }

  return Buffer.from(value).toString('utf-8');
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
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private statusChangedCallback: (() => void) | null = null;
  private refreshDeviceTokenCallback: (() => Promise<OfficialRemoteTokenRefreshResult>) | null = null;
  private unregisterBridgeBroadcast: (() => void) | null = null;
  private socket: WebSocket | null = null;
  private activeToken: string | null = null;
  private tokenRefreshInFlight: Promise<void> | null = null;
  private relayUrl = buildOfficialRemoteRelayWebSocketUrl();
  private state: OfficialRemoteStatus = {
    desired: false,
    running: false,
    transport: 'cloud-relay',
    relayUrl: this.relayUrl,
  };

  public initialize(
    statusChangedCallback?: () => void,
    refreshDeviceTokenCallback?: () => Promise<OfficialRemoteTokenRefreshResult>
  ): void {
    if (statusChangedCallback) {
      this.statusChangedCallback = statusChangedCallback;
    }
    if (refreshDeviceTokenCallback) {
      this.refreshDeviceTokenCallback = refreshDeviceTokenCallback;
    }

    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.unregisterBridgeBroadcast = registerWebSocketBroadcaster((name, data) => {
      this.sendFrame({
        type: 'bridge',
        payload: {
          name,
          data,
        },
      });
    });
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
    this.stopPingTimer();
    this.unregisterBridgeBroadcast?.();
    this.unregisterBridgeBroadcast = null;
    this.disconnectSocket();
  }

  public getState(): OfficialRemoteStatus {
    return { ...this.state };
  }

  private async reconcileInternal(_reason: string): Promise<void> {
    const rawToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    const deviceToken = typeof rawToken === 'string' && rawToken.trim() !== '' ? rawToken.trim() : null;
    const desired = Boolean(deviceToken);

    if (!desired || !deviceToken) {
      this.activeToken = null;
      this.updateState({
        desired: false,
        running: false,
        clientConnected: false,
        transport: 'cloud-relay',
        relayUrl: this.relayUrl,
        message: 'Official Remote is not enabled on this desktop yet.',
        needsAttention: false,
      });
      this.disconnectSocket();
      return;
    }

    this.updateState({
      desired: true,
      transport: 'cloud-relay',
      relayUrl: this.relayUrl,
      needsAttention: false,
    });

    if (this.socket && this.activeToken !== deviceToken) {
      this.disconnectSocket();
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.connectSocket(deviceToken);
  }

  private connectSocket(deviceToken: string): void {
    this.activeToken = deviceToken;
    this.updateState({
      desired: true,
      running: false,
      transport: 'cloud-relay',
      relayUrl: this.relayUrl,
      message: 'Connecting to ContextGo Cloud relay.',
      needsAttention: false,
    });

    const socket = new WebSocket(this.relayUrl, {
      headers: {
        Authorization: `Bearer ${deviceToken}`,
      },
    });

    this.socket = socket;

    socket.on('open', () => {
      if (this.socket !== socket) {
        return;
      }

      this.startPingTimer();
      this.updateState({
        desired: true,
        running: true,
        clientConnected: false,
        transport: 'cloud-relay',
        relayUrl: this.relayUrl,
        message: DEFAULT_READY_MESSAGE,
        needsAttention: false,
      });
    });

    socket.on('message', (rawData: RawData) => {
      const frame = parseOfficialRemoteRelayFrame(rawDataToString(rawData));
      if (!frame) {
        return;
      }

      if (frame.type === 'ping') {
        this.sendFrame({ type: 'pong', timestamp: Date.now() });
        return;
      }

      if (frame.type === 'hello') {
        this.updateState({
          desired: true,
          running: true,
          clientConnected: false,
          transport: 'cloud-relay',
          relayUrl: this.relayUrl,
          message: DEFAULT_READY_MESSAGE,
          needsAttention: false,
        });
        return;
      }

      if (frame.type === 'client_status') {
        const clientConnected = frame.connected === true;
        this.updateState({
          desired: true,
          running: true,
          clientConnected,
          transport: 'cloud-relay',
          relayUrl: this.relayUrl,
          message: clientConnected ? 'A browser session is connected through Official Remote.' : DEFAULT_READY_MESSAGE,
          needsAttention: false,
        });
        return;
      }

      if (frame.type === 'bridge' && frame.payload?.name) {
        const emitter = getBridgeEmitter();
        emitter?.emit(frame.payload.name, frame.payload.data);
      }
    });

    socket.on('close', (code, reason) => {
      if (this.socket !== socket) {
        return;
      }

      this.socket = null;
      this.stopPingTimer();

      if (!this.state.desired) {
        return;
      }

      const reasonText = rawDataToString(reason).trim();
      if (OFFICIAL_REMOTE_AUTH_CLOSE_CODES.has(code)) {
        void this.handleAuthFailure(reasonText || `Official Remote relay disconnected (code ${code}).`);
        return;
      }

      const message = reasonText
        ? `Official Remote relay disconnected: ${reasonText}`
        : `Official Remote relay disconnected (code ${code}).`;
      this.updateState({
        desired: true,
        running: false,
        clientConnected: false,
        transport: 'cloud-relay',
        relayUrl: this.relayUrl,
        message,
        needsAttention: false,
      });
      this.scheduleRetry();
    });

    socket.on('error', (error) => {
      if (this.socket !== socket) {
        return;
      }

      this.updateState({
        desired: true,
        running: false,
        clientConnected: false,
        transport: 'cloud-relay',
        relayUrl: this.relayUrl,
        message: error instanceof Error ? error.message : String(error),
        needsAttention: false,
      });
    });
  }

  private disconnectSocket(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.stopPingTimer();

    const currentSocket = this.socket;
    this.socket = null;
    if (currentSocket && currentSocket.readyState === WebSocket.OPEN) {
      currentSocket.close(1000, 'Official Remote disabled');
    } else {
      currentSocket?.terminate();
    }
  }

  private startPingTimer(): void {
    this.stopPingTimer();
    this.pingTimer = setInterval(() => {
      this.sendFrame({ type: 'ping', timestamp: Date.now() });
    }, OFFICIAL_REMOTE_PING_INTERVAL_MS);
  }

  private stopPingTimer(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendFrame(frame: OfficialRemoteRelayFrame): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.socket.send(JSON.stringify(frame));
    } catch {
      // Ignore transient send errors; close handler will reconcile.
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

  private async handleAuthFailure(message: string): Promise<void> {
    this.updateState({
      desired: true,
      running: false,
      clientConnected: false,
      transport: 'cloud-relay',
      relayUrl: this.relayUrl,
      message,
      needsAttention: true,
    });

    if (!this.refreshDeviceTokenCallback) {
      this.scheduleRetry();
      return;
    }

    if (this.tokenRefreshInFlight) {
      await this.tokenRefreshInFlight;
      return;
    }

    this.tokenRefreshInFlight = this.refreshDeviceTokenCallback()
      .then(async (result) => {
        this.tokenRefreshInFlight = null;
        this.activeToken = null;

        if (!result.refreshed) {
          this.updateState({
            desired: false,
            running: false,
            clientConnected: false,
            transport: 'cloud-relay',
            relayUrl: this.relayUrl,
            message: result.message || DEFAULT_REAUTH_MESSAGE,
            needsAttention: true,
          });
          return;
        }

        await this.reconcile('token-refresh');
      })
      .catch((error: unknown) => {
        this.tokenRefreshInFlight = null;
        this.updateState({
          desired: true,
          running: false,
          clientConnected: false,
          transport: 'cloud-relay',
          relayUrl: this.relayUrl,
          message: error instanceof Error ? error.message : DEFAULT_REAUTH_MESSAGE,
          needsAttention: true,
        });
        this.scheduleRetry();
      });

    await this.tokenRefreshInFlight;
  }

  private updateState(nextPartialState: Partial<OfficialRemoteStatus>): void {
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
