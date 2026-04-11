/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app, session, shell } from 'electron';
import type { Session } from 'electron';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { hostname } from 'node:os';
import { ipcBridge } from '@/common';
import { INFERMESH_LOGIN_URL } from '@/common/config/constants';
import { buildCloudDesktopOAuthStartUrl } from '@/common/utils/cloudAuth';
import type { CloudAuthProviderId, CloudDevice, CloudStatus, CloudUser } from '@/common/types/cloud';
import { ProcessConfig } from '@process/utils/initStorage';
import { onDeepLinkReceived } from '@process/utils/deepLink';
import type { DeepLinkPayload } from '@process/utils/deepLink';
import {
  CLOUD_API_BASE_URL,
  CLOUD_AUTH_BASE_URL,
  CLOUD_AUTH_PROVIDERS,
  CLOUD_AUTH_SESSION_PARTITION,
} from './constants';
import { getOfficialRemoteTunnelService } from './OfficialRemoteTunnelService';
import { ensureDesktopWebUIForOfficialRemote, releaseDesktopWebUIForOfficialRemote } from '@process/utils/webuiConfig';

type SessionPayload = {
  authenticated?: boolean;
  user?: CloudUser | null;
};

type DeviceRegisterPayload = {
  success?: boolean;
  device?: CloudDevice;
  token?: string;
};

type CloudDeviceKind = 'desktop' | 'webui';

type DesktopLoginConsumePayload = SessionPayload & {
  success?: boolean;
  provider?: CloudAuthProviderId;
};

type InfermeshHandoffPayload = {
  success?: boolean;
  url?: string;
};

type DesktopLoginResultWaiter = {
  promise: Promise<DeepLinkPayload>;
  cancel: () => void;
};

type DesktopLoopbackLoginResultWaiter = DesktopLoginResultWaiter & {
  callbackUrl: string;
};

class CloudRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string
  ) {
    super(message);
    this.name = 'CloudRequestError';
  }
}

const CLOUD_USER_KEY = 'cloud.user';
const CLOUD_DEVICE_KEY = 'cloud.device';
const CLOUD_DEVICE_TOKEN_KEY = 'cloud.deviceToken';
const CLOUD_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const CLOUD_LOGIN_LOOPBACK_HOST = '127.0.0.1';
const CLOUD_LOGIN_LOOPBACK_PATH_PREFIX = '/contextgo-cloud-login';
const OFFICIAL_REMOTE_READY_TIMEOUT_MS = 8_000;
const OFFICIAL_REMOTE_READY_POLL_MS = 250;

const isCloudRequestError = (error: unknown): error is CloudRequestError => error instanceof CloudRequestError;

function sameUser(left?: CloudUser | null, right?: CloudUser | null): boolean {
  if (!left || !right) {
    return false;
  }

  return left.id === right.id;
}

function buildDevicePlatform(): string {
  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return process.platform;
  }
}

function buildDeviceName(): string {
  const appName = app.getName() || 'ContextGo';
  return `${appName} on ${hostname()}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const body = await response.text();
  if (!body) {
    return null;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

async function readErrorResponse(response: Response): Promise<CloudRequestError> {
  const body = await response.text();
  return new CloudRequestError(
    `Cloud request failed with status ${response.status}`,
    response.status,
    body || response.statusText
  );
}

function noop(): void {}

function resolveDeepLinkNoop(_payload: DeepLinkPayload): void {}

function rejectErrorNoop(_error: Error): void {}

function escapeLoopbackResponseHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function buildLoopbackDesktopLoginResponse(isError: boolean, message: string): string {
  const escapedMessage = escapeLoopbackResponseHtml(message);
  const title = isError ? 'ContextGo sign-in needs attention' : 'ContextGo sign-in completed';
  const statusClass = isError ? 'error' : 'success';

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${title}</title>`,
    '  <style>',
    '    body {',
    '      margin: 0;',
    '      font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '      background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);',
    '      color: #0f172a;',
    '    }',
    '    main {',
    '      min-height: 100vh;',
    '      display: grid;',
    '      place-items: center;',
    '      padding: 24px;',
    '    }',
    '    section {',
    '      width: min(520px, 100%);',
    '      background: rgba(255, 255, 255, 0.94);',
    '      border: 1px solid rgba(15, 23, 42, 0.08);',
    '      border-radius: 24px;',
    '      box-shadow: 0 24px 80px rgba(15, 23, 42, 0.12);',
    '      padding: 32px;',
    '    }',
    '    h1 {',
    '      margin: 0 0 10px;',
    '      font-size: 30px;',
    '    }',
    '    p {',
    '      margin: 0;',
    '      line-height: 1.6;',
    '      color: #475569;',
    '    }',
    '    .status {',
    '      margin-top: 18px;',
    '      padding: 14px 16px;',
    '      border-radius: 16px;',
    '    }',
    '    .status.success {',
    '      background: #ecfdf5;',
    '      color: #166534;',
    '    }',
    '    .status.error {',
    '      background: #fef2f2;',
    '      color: #991b1b;',
    '    }',
    '  </style>',
    '</head>',
    '<body>',
    '  <main>',
    '    <section>',
    '      <h1>ContextGo account</h1>',
    '      <p>Browser sign-in has finished for this desktop session.</p>',
    `      <div class="status ${statusClass}">${escapedMessage}</div>`,
    '    </section>',
    '  </main>',
    '</body>',
    '</html>',
  ].join('\n');
}

export class CloudService {
  private static instance: CloudService | null = null;

  public static getInstance(): CloudService {
    if (!CloudService.instance) {
      CloudService.instance = new CloudService();
    }

    return CloudService.instance;
  }

  private authSession: Session | null = null;
  private loginInProgress = false;
  private initialized = false;
  private readonly officialRemoteTunnelService = getOfficialRemoteTunnelService();

  private constructor() {}

  public initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.officialRemoteTunnelService.initialize(
      () => {
        void this.emitStatusChanged().catch((error: unknown) => {
          console.warn('[Cloud] Failed to emit status after official remote change:', error);
        });
      },
      async () => this.refreshOfficialRemoteDeviceRegistration()
    );
    void this.initializeAfterReady();
  }

  public async getStatus(): Promise<CloudStatus> {
    const [storedUser, storedDevice, storedDeviceToken, sessionUser] = await Promise.all([
      ProcessConfig.get(CLOUD_USER_KEY),
      ProcessConfig.get(CLOUD_DEVICE_KEY),
      ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY),
      this.fetchSessionUser().catch((error: unknown): CloudUser | null => {
        console.warn('[Cloud] Failed to refresh browser session:', error);
        return null;
      }),
    ]);

    let effectiveUser = (storedUser as CloudUser | undefined) ?? null;
    let effectiveDevice = (storedDevice as CloudDevice | undefined) ?? null;
    let deviceToken = storedDeviceToken as string | undefined;

    if (sessionUser) {
      if (!sameUser(sessionUser, effectiveUser)) {
        effectiveDevice = null;
        deviceToken = undefined;

        await ProcessConfig.remove(CLOUD_DEVICE_KEY);
        await ProcessConfig.remove(CLOUD_DEVICE_TOKEN_KEY);
      }

      effectiveUser = sessionUser;
      await ProcessConfig.set(CLOUD_USER_KEY, sessionUser);
    }

    const officialRemote = this.officialRemoteTunnelService.getState();
    const officialRemoteReady =
      Boolean(deviceToken) && officialRemote.running === true && officialRemote.browserEntryReady === true;

    return {
      authenticated: Boolean(sessionUser),
      browserSessionExpired: !sessionUser && Boolean(effectiveUser),
      user: effectiveUser,
      device: effectiveDevice,
      deviceTokenAvailable: Boolean(deviceToken),
      officialRemote,
      officialRemoteReady,
      providers: CLOUD_AUTH_PROVIDERS,
      authBaseUrl: CLOUD_AUTH_BASE_URL,
      apiBaseUrl: CLOUD_API_BASE_URL,
    };
  }

  public async startLogin(provider: CloudAuthProviderId): Promise<CloudStatus> {
    await this.getAuthSession();

    if (this.loginInProgress) {
      throw new Error('Cloud login is already in progress');
    }

    this.loginInProgress = true;

    try {
      const { startUrl, waiter } = await this.prepareDesktopLoginFlow(provider);

      try {
        await shell.openExternal(startUrl);
      } catch (error) {
        waiter.cancel();
        await waiter.promise.catch((): void => undefined);
        throw error;
      }

      const payload = await waiter.promise;
      const errorCode = payload.params.error?.trim();
      if (errorCode) {
        if (errorCode === 'cancelled') {
          throw new Error('Cloud login was cancelled');
        }

        throw new Error(`Cloud login failed: ${errorCode}`);
      }

      const code = payload.params.code?.trim();
      if (!code) {
        throw new Error('Cloud login did not return a desktop session code');
      }

      await this.completeDesktopLogin(code);
    } finally {
      this.loginInProgress = false;
    }

    await this.ensureBrowserSessionUser();
    await this.ensureDeviceRegistration(true);
    await ensureDesktopWebUIForOfficialRemote().catch((error: unknown) => {
      console.warn('[Cloud] Failed to prepare desktop browser entry after login:', error);
    });
    await this.officialRemoteTunnelService.reconcile('cloud-login');

    const status = await this.getStatus();
    await this.emitStatusChanged(status);
    return status;
  }

  public async ensureOfficialRemoteReady(): Promise<CloudStatus> {
    const status = await this.getStatus();
    if (!status.authenticated) {
      throw new Error('Cloud browser session is not authenticated');
    }

    if (!status.deviceTokenAvailable) {
      await this.ensureDeviceRegistration(true);
    }

    await ensureDesktopWebUIForOfficialRemote();
    await this.officialRemoteTunnelService.reconcile('official-remote-ensure-ready');

    const nextStatus = await this.waitForOfficialRemoteReady();
    await this.emitStatusChanged(nextStatus);
    return nextStatus;
  }

  public async openInfermesh(): Promise<CloudStatus> {
    await this.getAuthSession();

    let status = await this.getStatus();
    if (!status.authenticated) {
      await shell.openExternal(INFERMESH_LOGIN_URL);
      return status;
    }

    if (!status.deviceTokenAvailable) {
      try {
        await this.ensureDeviceRegistration(true);
        status = await this.getStatus();
      } catch (error) {
        console.warn('[Cloud] Failed to register desktop device before opening InferMesh:', error);
      }
    }

    if (!status.deviceTokenAvailable) {
      await shell.openExternal(INFERMESH_LOGIN_URL);
      return status;
    }

    const deviceToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    if (typeof deviceToken !== 'string' || !deviceToken.trim()) {
      throw new Error('Cloud device token is missing for InferMesh handoff');
    }

    const handoffUrl = await this.createInfermeshHandoffUrl(deviceToken.trim());
    await shell.openExternal(handoffUrl);
    return status;
  }

  public async logout(): Promise<CloudStatus> {
    await this.getAuthSession();

    await this.authSession
      .fetch(`${CLOUD_AUTH_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      })
      .catch((): null => null);

    await this.authSession.clearStorageData({
      storages: ['cookies'],
    });

    await this.clearStoredState();
    await this.officialRemoteTunnelService.reconcile('cloud-logout');
    await releaseDesktopWebUIForOfficialRemote().catch((error: unknown) => {
      console.warn('[Cloud] Failed to release Official Remote desktop runtime after logout:', error);
    });
    const status = await this.getStatus();
    await this.emitStatusChanged(status);
    return status;
  }

  public handleSystemResume(): void {
    void this.restoreOfficialRemoteAfterResume();
  }

  public async shutdown(): Promise<void> {
    await this.officialRemoteTunnelService.dispose();
  }

  public async ensureDeviceRegistration(force = false): Promise<void> {
    await this.ensureDeviceRegistrationByKind('desktop', force);
  }

  private async ensureDeviceRegistrationByKind(kind: CloudDeviceKind, force = false): Promise<void> {
    await this.getAuthSession();
    const status = await this.getStatus();
    if (!status.authenticated) {
      throw new Error('Cloud browser session is not authenticated');
    }

    if (kind === 'desktop' && !force && status.device && status.deviceTokenAvailable) {
      return;
    }

    const response = await this.authSession.fetch(`${CLOUD_API_BASE_URL}/api/devices/register`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceName: buildDeviceName(),
        platform: buildDevicePlatform(),
        deviceKind: kind,
      }),
    });

    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    const payload = await parseJsonResponse<DeviceRegisterPayload>(response);
    if (!payload?.success || !payload.device || !payload.token) {
      throw new Error('Cloud device registration returned an invalid payload');
    }

    await ProcessConfig.set(CLOUD_DEVICE_KEY, payload.device);
    await ProcessConfig.set(CLOUD_DEVICE_TOKEN_KEY, payload.token);
  }

  private async createInfermeshHandoffUrl(deviceToken: string): Promise<string> {
    const authSession = await this.getAuthSession();
    const response = await authSession.fetch(`${CLOUD_API_BASE_URL}/api/integrations/infermesh/handoff`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
    });

    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    const payload = await parseJsonResponse<InfermeshHandoffPayload>(response);
    if (!payload?.success || !payload.url) {
      throw new Error('InferMesh handoff returned an invalid payload');
    }

    return payload.url;
  }

  private async fetchSessionUser(): Promise<CloudUser | null> {
    const authSession = await this.getAuthSession();
    const response = await authSession.fetch(`${CLOUD_API_BASE_URL}/api/auth/session`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    const payload = await parseJsonResponse<SessionPayload>(response);
    if (!payload?.authenticated || !payload.user) {
      return null;
    }

    return payload.user;
  }

  private async ensureBrowserSessionUser(): Promise<CloudUser> {
    const sessionUser = await this.fetchSessionUser();
    if (!sessionUser) {
      throw new Error('Cloud browser session is not available after login');
    }

    await ProcessConfig.set(CLOUD_USER_KEY, sessionUser);
    return sessionUser;
  }

  private async prepareDesktopLoginFlow(
    provider: CloudAuthProviderId
  ): Promise<{ startUrl: string; waiter: DesktopLoginResultWaiter }> {
    const deepLinkWaiter = this.createDeepLinkDesktopLoginResultWaiter(provider);
    let loopbackWaiter: DesktopLoopbackLoginResultWaiter | null = null;

    try {
      loopbackWaiter = await this.createLoopbackDesktopLoginResultWaiter(provider);
    } catch (error) {
      console.warn('[Cloud] Failed to prepare loopback desktop login callback, falling back to deep link:', error);
    }

    let settled = false;
    let failedWaiters = 0;
    const totalWaiters = loopbackWaiter ? 2 : 1;
    let resolvePromise: (payload: DeepLinkPayload) => void = resolveDeepLinkNoop;
    let rejectPromise: (error: Error) => void = rejectErrorNoop;

    const cancelInnerWaiters = (): void => {
      loopbackWaiter?.cancel();
      deepLinkWaiter.cancel();
    };

    const promise = new Promise<DeepLinkPayload>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = (error): void => reject(error);
    });

    const settleSuccess = (payload: DeepLinkPayload): void => {
      if (settled) {
        return;
      }

      settled = true;
      cancelInnerWaiters();
      resolvePromise(payload);
    };

    const settleFailure = (source: 'loopback' | 'deep-link', error: Error): void => {
      if (settled) {
        return;
      }

      failedWaiters += 1;
      if (failedWaiters < totalWaiters) {
        console.warn(`[Cloud] ${source} desktop login callback failed, waiting for fallback result:`, error);
        return;
      }

      settled = true;
      rejectPromise(error);
    };

    loopbackWaiter?.promise.then(settleSuccess, (error: Error) => settleFailure('loopback', error));
    deepLinkWaiter.promise.then(settleSuccess, (error: Error) => settleFailure('deep-link', error));

    return {
      startUrl: buildCloudDesktopOAuthStartUrl(provider, {
        loopbackCallbackUrl: loopbackWaiter?.callbackUrl,
      }),
      waiter: {
        promise,
        cancel: () => {
          if (settled) {
            return;
          }

          settled = true;
          cancelInnerWaiters();
          rejectPromise(new Error('Cloud login was interrupted'));
        },
      },
    };
  }

  private createDeepLinkDesktopLoginResultWaiter(provider: CloudAuthProviderId): DesktopLoginResultWaiter {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe: () => void = noop;
    let resolvePromise: (payload: DeepLinkPayload) => void = resolveDeepLinkNoop;
    let rejectPromise: (error: Error) => void = rejectErrorNoop;

    const finalize = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
      callback();
    };

    const promise = new Promise<DeepLinkPayload>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = (error): void => reject(error);
      timeoutId = setTimeout(() => {
        finalize(() => reject(new Error('Timed out waiting for cloud login to complete')));
      }, CLOUD_LOGIN_TIMEOUT_MS);
    });

    unsubscribe = onDeepLinkReceived((payload) => {
      if (payload.action !== 'cloud-login') {
        return;
      }

      const returnedProvider = payload.params.provider;
      if (returnedProvider && returnedProvider !== provider) {
        return;
      }

      finalize(() => resolvePromise(payload));
    });

    return {
      promise,
      cancel: () => finalize(() => rejectPromise(new Error('Cloud login was interrupted'))),
    };
  }

  private async createLoopbackDesktopLoginResultWaiter(
    provider: CloudAuthProviderId
  ): Promise<DesktopLoopbackLoginResultWaiter> {
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let resolvePromise: (payload: DeepLinkPayload) => void = resolveDeepLinkNoop;
    let rejectPromise: (error: Error) => void = rejectErrorNoop;

    const callbackPath = `${CLOUD_LOGIN_LOOPBACK_PATH_PREFIX}/${randomUUID()}`;
    const server = createServer((request, response) => {
      this.handleLoopbackDesktopLoginRequest({
        provider,
        callbackPath,
        request,
        response,
        settle: (payload) => finalize(() => resolvePromise(payload)),
      });
    });

    const finalize = (callback: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      server.close();
      callback();
    };

    const promise = new Promise<DeepLinkPayload>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = (error): void => reject(error);
      timeoutId = setTimeout(() => {
        finalize(() => reject(new Error('Timed out waiting for cloud login to complete')));
      }, CLOUD_LOGIN_TIMEOUT_MS);
    });

    await new Promise<void>((resolve, reject) => {
      const handleError = (error: Error): void => {
        server.off('listening', handleListening);
        reject(error);
      };
      const handleListening = (): void => {
        server.off('error', handleError);
        resolve();
      };

      server.once('error', handleError);
      server.once('listening', handleListening);
      server.listen(0, CLOUD_LOGIN_LOOPBACK_HOST);
    }).catch((error: unknown) => {
      server.close();
      throw error;
    });

    server.on('error', (error: Error) => {
      finalize(() => rejectPromise(new Error(`Failed to receive cloud login callback: ${error.message}`)));
    });
    server.unref();

    const address = server.address();
    if (!address || typeof address === 'string') {
      finalize(() => rejectPromise(new Error('Failed to bind local cloud login callback listener')));
      throw new Error('Failed to bind local cloud login callback listener');
    }

    const callbackUrl = `http://${CLOUD_LOGIN_LOOPBACK_HOST}:${(address as AddressInfo).port}${callbackPath}`;
    return {
      callbackUrl,
      promise,
      cancel: () => finalize(() => rejectPromise(new Error('Cloud login was interrupted'))),
    };
  }

  private handleLoopbackDesktopLoginRequest(input: {
    provider: CloudAuthProviderId;
    callbackPath: string;
    request: IncomingMessage;
    response: ServerResponse<IncomingMessage>;
    settle: (payload: DeepLinkPayload) => void;
  }): void {
    const { provider, callbackPath, request, response, settle } = input;
    const requestUrl = new URL(request.url ?? '/', `http://${CLOUD_LOGIN_LOOPBACK_HOST}`);

    if (request.method !== 'GET') {
      response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Method not allowed');
      return;
    }

    if (requestUrl.pathname !== callbackPath) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    const params = Object.fromEntries(requestUrl.searchParams.entries());
    const returnedProvider = params.provider?.trim();
    if (returnedProvider && returnedProvider !== provider) {
      response.writeHead(409, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(
        buildLoopbackDesktopLoginResponse(
          true,
          'ContextGo sign-in finished for a different provider. Please retry from the app.'
        )
      );
      return;
    }

    const errorCode = params.error?.trim();
    const message = errorCode
      ? `ContextGo sign-in could not be completed: ${errorCode}. You can return to the app.`
      : 'ContextGo sign-in succeeded. You can return to the app.';

    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(buildLoopbackDesktopLoginResponse(Boolean(errorCode), message));
    settle({ action: 'cloud-login', params });
  }

  private async completeDesktopLogin(code: string): Promise<void> {
    const authSession = await this.getAuthSession();
    const response = await authSession.fetch(`${CLOUD_AUTH_BASE_URL}/api/auth/desktop/consume`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    const payload = await parseJsonResponse<DesktopLoginConsumePayload>(response);
    if (!payload?.success || !payload.authenticated || !payload.user) {
      throw new Error('Desktop login exchange returned an invalid session payload');
    }
  }

  private async clearStoredState(): Promise<void> {
    await ProcessConfig.remove(CLOUD_USER_KEY);
    await ProcessConfig.remove(CLOUD_DEVICE_KEY);
    await ProcessConfig.remove(CLOUD_DEVICE_TOKEN_KEY);
  }

  private async clearStoredDeviceBinding(): Promise<void> {
    await ProcessConfig.remove(CLOUD_DEVICE_KEY);
    await ProcessConfig.remove(CLOUD_DEVICE_TOKEN_KEY);
    await releaseDesktopWebUIForOfficialRemote().catch((error: unknown) => {
      console.warn('[Cloud] Failed to release Official Remote desktop runtime after clearing device binding:', error);
    });
  }

  private async ensureSignedInDesktopDeviceBinding(status?: CloudStatus): Promise<CloudStatus> {
    const nextStatus = status ?? (await this.getStatus());
    if (!nextStatus.authenticated || nextStatus.deviceTokenAvailable) {
      return nextStatus;
    }

    await this.ensureDeviceRegistration(true);
    await ensureDesktopWebUIForOfficialRemote().catch((error: unknown) => {
      console.warn('[Cloud] Failed to prepare desktop browser entry for signed-in device binding:', error);
    });
    return this.getStatus();
  }

  private async refreshOfficialRemoteDeviceRegistration(): Promise<{ refreshed: boolean; message?: string }> {
    const sessionUser = await this.fetchSessionUser().catch((): CloudUser | null => null);
    if (!sessionUser) {
      await this.clearStoredDeviceBinding();
      await this.emitStatusChanged().catch((error: unknown) => {
        console.warn('[Cloud] Failed to emit status after clearing stale Official Remote device token:', error);
      });
      return {
        refreshed: false,
        message: 'Official Remote needs a fresh cloud login before this desktop can reconnect.',
      };
    }

    await ProcessConfig.set(CLOUD_USER_KEY, sessionUser);
    await this.ensureDeviceRegistration(true);
    await ensureDesktopWebUIForOfficialRemote().catch((error: unknown) => {
      console.warn(
        '[Cloud] Failed to prepare desktop browser entry after refreshing Official Remote device token:',
        error
      );
    });
    await this.emitStatusChanged().catch((error: unknown) => {
      console.warn('[Cloud] Failed to emit status after refreshing Official Remote device token:', error);
    });
    return { refreshed: true };
  }

  private async emitStatusChanged(status?: CloudStatus): Promise<void> {
    const nextStatus = status ?? (await this.getStatus());
    ipcBridge.cloud.statusChanged.emit(nextStatus);
  }

  private async waitForOfficialRemoteReady(): Promise<CloudStatus> {
    const deadline = Date.now() + OFFICIAL_REMOTE_READY_TIMEOUT_MS;
    let lastStatus = await this.getStatus();

    while (Date.now() < deadline) {
      if (lastStatus.officialRemoteReady) {
        return lastStatus;
      }

      if (lastStatus.officialRemote?.needsAttention) {
        return lastStatus;
      }

      await new Promise((resolve) => setTimeout(resolve, OFFICIAL_REMOTE_READY_POLL_MS));
      lastStatus = await this.getStatus();
    }

    return lastStatus;
  }

  private async initializeAfterReady(): Promise<void> {
    await app.whenReady();

    let initialStatus = await this.getStatus();
    if (initialStatus.deviceTokenAvailable) {
      await this.ensureOfficialRemoteRuntimeForStoredBinding('startup');
      initialStatus = await this.getStatus();
    } else if (initialStatus.authenticated) {
      try {
        initialStatus = await this.ensureSignedInDesktopDeviceBinding(initialStatus);
      } catch (error) {
        console.warn('[Cloud] Failed to auto-register signed-in desktop device:', error);
      }
    }

    await this.emitStatusChanged(initialStatus);
    await this.officialRemoteTunnelService.reconcile('cloud-init');
  }

  private async restoreOfficialRemoteAfterResume(): Promise<void> {
    await this.ensureOfficialRemoteRuntimeForStoredBinding('system resume');
    await this.officialRemoteTunnelService.reconcile('system-resume');
  }

  private async ensureOfficialRemoteRuntimeForStoredBinding(reason: string): Promise<void> {
    const deviceToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    const hasStoredDeviceToken = typeof deviceToken === 'string' && deviceToken.trim() !== '';

    if (!hasStoredDeviceToken) {
      return;
    }

    await ensureDesktopWebUIForOfficialRemote().catch((error: unknown) => {
      console.warn(`[Cloud] Failed to auto-prepare Official Remote browser entry on ${reason}:`, error);
    });
  }

  private async getAuthSession(): Promise<Session> {
    await app.whenReady();

    if (!this.authSession) {
      this.authSession = session.fromPartition(CLOUD_AUTH_SESSION_PARTITION, { cache: true });
    }

    return this.authSession;
  }
}

export function getCloudService(): CloudService {
  return CloudService.getInstance();
}
