/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Buffer } from 'node:buffer';
import WebSocket, { type RawData } from 'ws';
import { ProcessConfig } from '@process/utils/initStorage';
import { getWebServerInstance } from '@process/bridge/webuiBridge';

const DESKTOP_WEBUI_PORT_KEY = 'webui.desktop.port';
const LOCAL_WEBUI_HOST = '127.0.0.1';
const VITE_DEV_PORT = 5173;
const VITE_DEV_PROBE_PATH = '/@vite/client';
const VITE_DEV_PROBE_TIMEOUT_MS = 1_000;

type RemoteHttpRelayFrame = {
  requestId?: string;
  request?: {
    method?: string;
    path?: string;
    query?: string;
    headers?: Record<string, string>;
    bodyBase64?: string;
  };
};

type ViteClientConnectFrame = {
  socketId?: string;
  query?: string;
  protocols?: string[];
};

type ViteClientFrame = {
  socketId?: string;
  data?: string;
};

type ViteClientDisconnectFrame = {
  socketId?: string;
  code?: number;
  reason?: string;
};

type SendFrame = (frame: unknown) => void;

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

function sanitizeRequestHeaders(headers: Record<string, string> | undefined): Headers {
  const nextHeaders = new Headers();
  if (!headers) {
    return nextHeaders;
  }

  for (const [rawName, rawValue] of Object.entries(headers)) {
    const name = rawName.trim().toLowerCase();
    const value = rawValue?.trim();
    if (!value) {
      continue;
    }

    if (
      name === 'host' ||
      name === 'content-length' ||
      name === 'connection' ||
      name === 'upgrade' ||
      name === 'sec-websocket-key' ||
      name === 'sec-websocket-version' ||
      name === 'sec-websocket-extensions' ||
      name === 'sec-websocket-protocol'
    ) {
      continue;
    }

    nextHeaders.set(rawName, rawValue);
  }

  return nextHeaders;
}

async function resolveLocalWebUiBaseUrl(): Promise<string | null> {
  try {
    const instance = getWebServerInstance();
    if (instance?.port && Number.isFinite(instance.port) && instance.port > 0) {
      return `http://${LOCAL_WEBUI_HOST}:${instance.port}`;
    }
  } catch {
    // Ignore lookup failures and fall back to persisted config.
  }

  const storedPort = await ProcessConfig.get(DESKTOP_WEBUI_PORT_KEY);
  const port = typeof storedPort === 'number' && Number.isFinite(storedPort) && storedPort > 0 ? storedPort : null;
  if (!port) {
    return null;
  }

  return `http://${LOCAL_WEBUI_HOST}:${port}`;
}

function formatHostForUrl(hostname: string): string {
  return hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname;
}

function normalizeCandidateUrl(url: URL): URL {
  const candidate = new URL(url.toString());
  candidate.pathname = '/';
  candidate.search = '';
  candidate.hash = '';
  return candidate;
}

export function buildLocalViteDevProbeUrls(): URL[] {
  const candidates: URL[] = [];
  const seen = new Set<string>();

  const pushCandidate = (url: URL): void => {
    const normalized = normalizeCandidateUrl(url);
    const key = `${normalized.protocol}//${normalized.host}`;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    candidates.push(normalized);
  };

  const configuredRendererUrl = process.env['ELECTRON_RENDERER_URL']?.trim();
  if (configuredRendererUrl) {
    try {
      pushCandidate(new URL(configuredRendererUrl));
    } catch {
      // Ignore malformed renderer URLs and continue with loopback fallbacks.
    }
  }

  for (const hostname of ['localhost', '::1', '127.0.0.1']) {
    pushCandidate(new URL(`http://${formatHostForUrl(hostname)}:${VITE_DEV_PORT}/`));
  }

  return candidates;
}

async function canReachViteDevServer(candidate: URL): Promise<boolean> {
  const probeUrl = new URL(VITE_DEV_PROBE_PATH, candidate);

  try {
    const response = await fetch(probeUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(VITE_DEV_PROBE_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function resolveLocalViteDevWebSocketUrl(query?: string): Promise<URL | null> {
  for (const candidate of buildLocalViteDevProbeUrls()) {
    if (!(await canReachViteDevServer(candidate))) {
      continue;
    }

    const socketUrl = new URL(candidate.toString());
    socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    if (query) {
      socketUrl.search = query;
    }
    return socketUrl;
  }

  return null;
}

export class OfficialRemoteBrowserRelay {
  private readonly viteSockets = new Map<string, WebSocket>();

  constructor(private readonly sendFrame: SendFrame) {}

  public async dispose(): Promise<void> {
    const sockets = Array.from(this.viteSockets.values());
    this.viteSockets.clear();
    for (const socket of sockets) {
      try {
        socket.close(1000, 'Official Remote browser relay disposed');
      } catch {
        socket.terminate();
      }
    }
  }

  public async handleHttpRequest(frame: RemoteHttpRelayFrame): Promise<void> {
    const requestId = frame.requestId?.trim();
    const request = frame.request;
    const method = request?.method?.trim().toUpperCase() || 'GET';
    const path = request?.path?.trim() || '/';
    const query = request?.query?.trim();

    if (!requestId || !request) {
      return;
    }

    try {
      const baseUrl = await resolveLocalWebUiBaseUrl();
      if (!baseUrl) {
        this.sendFrame({
          type: 'http_error',
          requestId,
          message: 'Desktop WebUI is not available for Official Remote.',
        });
        return;
      }

      const targetUrl = new URL(path.startsWith('/') ? path : `/${path}`, baseUrl);
      if (query) {
        targetUrl.search = query;
      }

      const headers = sanitizeRequestHeaders(request.headers);
      const forwardedHost = request.headers?.['x-forwarded-host']?.trim() || request.headers?.host?.trim();
      if (forwardedHost) {
        headers.set('x-forwarded-host', forwardedHost);
      }

      const body = request.bodyBase64 ? Buffer.from(request.bodyBase64, 'base64') : undefined;
      const response = await fetch(targetUrl, {
        method,
        headers,
        body: method === 'GET' || method === 'HEAD' ? undefined : body,
        redirect: 'manual',
      });

      const responseBody = Buffer.from(await response.arrayBuffer()).toString('base64');
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          return;
        }
        responseHeaders[key] = value;
      });

      const setCookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
      this.sendFrame({
        type: 'http_response',
        requestId,
        response: {
          statusCode: response.status,
          headers: responseHeaders,
          bodyBase64: responseBody,
          setCookies,
        },
      });
    } catch (error) {
      this.sendFrame({
        type: 'http_error',
        requestId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async handleViteClientConnect(frame: ViteClientConnectFrame): Promise<void> {
    const socketId = frame.socketId?.trim();
    if (!socketId) {
      return;
    }

    this.closeViteSocket(socketId, 1000, 'Remote Vite session replaced');

    const viteUrl = await resolveLocalViteDevWebSocketUrl(frame.query?.trim() || undefined);
    if (!viteUrl) {
      this.sendFrame({
        type: 'vite_client_disconnect',
        socketId,
        code: 1011,
        reason: 'Failed to locate a reachable local Vite dev server',
      });
      return;
    }

    const protocols = Array.isArray(frame.protocols) && frame.protocols.length > 0 ? frame.protocols : undefined;
    const socket = new WebSocket(viteUrl, protocols);
    this.viteSockets.set(socketId, socket);

    socket.on('message', (rawData: RawData) => {
      if (this.viteSockets.get(socketId) !== socket) {
        return;
      }

      this.sendFrame({
        type: 'vite_client_frame',
        socketId,
        data: rawDataToString(rawData),
      });
    });

    socket.on('close', (code, reason) => {
      if (this.viteSockets.get(socketId) === socket) {
        this.viteSockets.delete(socketId);
      }

      this.sendFrame({
        type: 'vite_client_disconnect',
        socketId,
        code,
        reason: rawDataToString(reason),
      });
    });

    socket.on('error', (error) => {
      if (this.viteSockets.get(socketId) !== socket) {
        return;
      }

      this.sendFrame({
        type: 'vite_client_disconnect',
        socketId,
        code: 1011,
        reason: error instanceof Error ? error.message : 'Failed to connect to local Vite dev server',
      });
      this.closeViteSocket(socketId, 1011, 'Local Vite relay failed');
    });
  }

  public handleViteClientFrame(frame: ViteClientFrame): void {
    const socketId = frame.socketId?.trim();
    if (!socketId) {
      return;
    }

    const socket = this.viteSockets.get(socketId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      socket.send(frame.data ?? '');
    } catch {
      this.closeViteSocket(socketId, 1011, 'Failed to forward Vite frame');
    }
  }

  public handleViteClientDisconnect(frame: ViteClientDisconnectFrame): void {
    const socketId = frame.socketId?.trim();
    if (!socketId) {
      return;
    }

    this.closeViteSocket(socketId, frame.code ?? 1000, frame.reason ?? 'Remote Vite client disconnected');
  }

  private closeViteSocket(socketId: string, code: number, reason: string): void {
    const socket = this.viteSockets.get(socketId);
    if (!socket) {
      return;
    }

    this.viteSockets.delete(socketId);
    try {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(code, reason);
      } else {
        socket.terminate();
      }
    } catch {
      socket.terminate();
    }
  }
}
