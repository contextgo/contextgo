/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app, session, shell } from 'electron';
import type { Session } from 'electron';
import { hostname } from 'node:os';
import { ipcBridge } from '@/common';
import { normalizeLanguageCode } from '@/common/config/i18n';
import { buildCloudDesktopOAuthStartUrl } from '@/common/utils/cloudAuth';
import type {
  CloudAuthProviderId,
  CloudDevice,
  CloudStatus,
  CloudStoredSyncState,
  CloudSyncSummary,
  CloudUser,
} from '@/common/types/cloud';
import { DEFAULT_LANGUAGE } from '@/common/config/i18n';
import { ProcessConfig } from '@process/utils/initStorage';
import { changeLanguage } from '@process/services/i18n';
import { onDeepLinkReceived } from '@process/utils/deepLink';
import type { DeepLinkPayload } from '@process/utils/deepLink';
import {
  applyPulledLanguage,
  ensureLanguageTimestamp,
  markLanguageChanged,
  markLanguageSynced,
  markSyncCompleted,
  normalizeStoredSyncState,
  shouldPushLanguage,
  toCloudSyncState,
  updateSyncCursor,
} from './syncState';
import {
  CLOUD_API_BASE_URL,
  CLOUD_AUTH_BASE_URL,
  CLOUD_AUTH_PROVIDERS,
  CLOUD_AUTH_SESSION_PARTITION,
  CLOUD_SYNC_LANGUAGE_KEY,
  CLOUD_SYNC_NAMESPACE,
} from './constants';
import { getOfficialRemoteTunnelService } from './OfficialRemoteTunnelService';
import { getInfermeshProviderSyncService } from './InfermeshProviderSyncService';

type SessionPayload = {
  authenticated?: boolean;
  user?: CloudUser | null;
};

type DeviceRegisterPayload = {
  success?: boolean;
  device?: CloudDevice;
  token?: string;
};

type DesktopLoginConsumePayload = SessionPayload & {
  success?: boolean;
  provider?: CloudAuthProviderId;
};

type SyncEvent = {
  cursor: number;
  deviceId?: string | null;
  namespace: string;
  key: string;
  value: unknown;
  deleted: boolean;
  clientUpdatedAt: string;
  createdAt: string;
};

type SyncPullPayload = {
  success?: boolean;
  events?: SyncEvent[];
  cursor?: number;
  hasMore?: boolean;
};

type SyncPushPayload = {
  success?: boolean;
  accepted?: Array<{ namespace: string; key: string; cursor: number }>;
  rejected?: Array<{ namespace: string; key: string; reason: string }>;
  cursor?: number;
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
const CLOUD_SYNC_STATE_KEY = 'cloud.sync.state';
const CLOUD_LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

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
  private readonly infermeshProviderSyncService = getInfermeshProviderSyncService();

  private constructor() {}

  public initialize(): void {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    this.officialRemoteTunnelService.initialize(() => {
      void this.emitStatusChanged().catch((error: unknown) => {
        console.warn('[Cloud] Failed to emit status after official remote change:', error);
      });
    });
    void this.initializeAfterReady();
  }

  public async getStatus(): Promise<CloudStatus> {
    const [storedUser, storedDevice, storedDeviceToken, storedSyncState, sessionUser] = await Promise.all([
      ProcessConfig.get(CLOUD_USER_KEY),
      ProcessConfig.get(CLOUD_DEVICE_KEY),
      ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY),
      ProcessConfig.get(CLOUD_SYNC_STATE_KEY),
      this.fetchSessionUser().catch((error: unknown): CloudUser | null => {
        console.warn('[Cloud] Failed to refresh browser session:', error);
        return null;
      }),
    ]);

    let effectiveUser = (storedUser as CloudUser | undefined) ?? null;
    let effectiveDevice = (storedDevice as CloudDevice | undefined) ?? null;
    let deviceToken = storedDeviceToken as string | undefined;
    let syncState = normalizeStoredSyncState(storedSyncState as CloudStoredSyncState | undefined);

    if (sessionUser) {
      if (!sameUser(sessionUser, effectiveUser)) {
        effectiveDevice = null;
        deviceToken = undefined;
        syncState = normalizeStoredSyncState(undefined);

        await ProcessConfig.remove(CLOUD_DEVICE_KEY);
        await ProcessConfig.remove(CLOUD_DEVICE_TOKEN_KEY);
        await ProcessConfig.remove(CLOUD_SYNC_STATE_KEY);
      }

      effectiveUser = sessionUser;
      await ProcessConfig.set(CLOUD_USER_KEY, sessionUser);
    }

    return {
      authenticated: Boolean(sessionUser),
      browserSessionExpired: !sessionUser && Boolean(effectiveUser),
      user: effectiveUser,
      device: effectiveDevice,
      deviceTokenAvailable: Boolean(deviceToken),
      officialRemote: this.officialRemoteTunnelService.getState(),
      providers: CLOUD_AUTH_PROVIDERS,
      authBaseUrl: CLOUD_AUTH_BASE_URL,
      apiBaseUrl: CLOUD_API_BASE_URL,
      syncState: toCloudSyncState(syncState),
    };
  }

  public async startLogin(provider: CloudAuthProviderId): Promise<CloudStatus> {
    await this.getAuthSession();

    if (this.loginInProgress) {
      throw new Error('Cloud login is already in progress');
    }

    this.loginInProgress = true;

    try {
      const startUrl = buildCloudDesktopOAuthStartUrl(provider);
      const waiter = this.createDesktopLoginResultWaiter(provider);

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
    await this.syncManagedInfermeshProvider().catch((error: unknown) => {
      console.warn('[Cloud] InferMesh provider sync failed after login:', error);
    });
    await this.syncNow().catch((error: unknown) => {
      console.warn('[Cloud] Post-login sync failed:', error);
    });
    await this.officialRemoteTunnelService.reconcile('cloud-login');

    const status = await this.getStatus();
    await this.emitStatusChanged(status);
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
    await this.infermeshProviderSyncService.removeManagedProvider().catch((error: unknown) => {
      console.warn('[Cloud] Failed to clear managed InferMesh provider during logout:', error);
    });
    await this.officialRemoteTunnelService.reconcile('cloud-logout');
    const status = await this.getStatus();
    await this.emitStatusChanged(status);
    return status;
  }

  public handleSystemResume(): void {
    void this.officialRemoteTunnelService.reconcile('system-resume');
  }

  public async shutdown(): Promise<void> {
    await this.officialRemoteTunnelService.dispose();
  }

  public async handleLocalLanguageChange(language: string): Promise<void> {
    const normalizedLanguage = normalizeLanguageCode(language);
    const nextSyncState = markLanguageChanged(
      (await ProcessConfig.get(CLOUD_SYNC_STATE_KEY)) as CloudStoredSyncState | undefined,
      new Date().toISOString()
    );

    await ProcessConfig.set(CLOUD_SYNC_STATE_KEY, nextSyncState);
    await ProcessConfig.set('language', normalizedLanguage);
    await this.emitStatusChanged();

    const deviceToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    if (!deviceToken) {
      return;
    }

    await this.syncNow().catch((error: unknown) => {
      console.warn('[Cloud] Automatic language sync failed:', error);
    });
  }

  public async syncNow(): Promise<CloudSyncSummary> {
    let reRegisteredDevice = false;

    const withToken = await this.withDeviceToken(async (deviceToken) => {
      const [storedLanguage, storedSyncState] = await Promise.all([
        ProcessConfig.get('language'),
        ProcessConfig.get(CLOUD_SYNC_STATE_KEY),
      ]);

      const normalizedLanguage = normalizeLanguageCode(String(storedLanguage || DEFAULT_LANGUAGE));
      let syncState = normalizeStoredSyncState(storedSyncState as CloudStoredSyncState | undefined);

      const pullPayload = await this.fetchSyncPull(deviceToken, syncState.cursor ?? 0);
      let pulledChanges = 0;
      let latestLanguageEvent: SyncEvent | null = null;

      for (const event of pullPayload.events ?? []) {
        syncState = updateSyncCursor(syncState, event.cursor);

        if (event.namespace !== CLOUD_SYNC_NAMESPACE || event.key !== CLOUD_SYNC_LANGUAGE_KEY || event.deleted) {
          continue;
        }

        if (typeof event.value !== 'string') {
          continue;
        }

        const currentTimestamp = syncState.languageUpdatedAt ?? '';
        if (currentTimestamp && currentTimestamp >= event.clientUpdatedAt) {
          continue;
        }

        latestLanguageEvent = event;
      }

      if (latestLanguageEvent) {
        await this.applyRemoteLanguage(latestLanguageEvent.value as string, latestLanguageEvent.clientUpdatedAt);
        syncState = applyPulledLanguage(syncState, latestLanguageEvent.clientUpdatedAt);
        pulledChanges = 1;
      }

      syncState = ensureLanguageTimestamp(syncState, new Date().toISOString());
      let pushedChanges = 0;

      if (shouldPushLanguage(syncState)) {
        const pushPayload = await this.fetchSyncPush(deviceToken, [
          {
            namespace: CLOUD_SYNC_NAMESPACE,
            key: CLOUD_SYNC_LANGUAGE_KEY,
            value: normalizedLanguage,
            deleted: false,
            clientUpdatedAt: syncState.languageUpdatedAt!,
          },
        ]);

        syncState = updateSyncCursor(syncState, pushPayload.cursor ?? syncState.cursor ?? 0);
        if ((pushPayload.accepted ?? []).length > 0) {
          syncState = markLanguageSynced(syncState);
          pushedChanges = pushPayload.accepted!.length;
        }
      }

      syncState = markSyncCompleted(syncState, new Date().toISOString());
      await ProcessConfig.set(CLOUD_SYNC_STATE_KEY, syncState);

      return {
        pushedChanges,
        pulledChanges,
      };
    });

    reRegisteredDevice = withToken.reRegisteredDevice;
    const status = await this.getStatus();
    await this.emitStatusChanged(status);

    return {
      status,
      pushedChanges: withToken.result.pushedChanges,
      pulledChanges: withToken.result.pulledChanges,
      reRegisteredDevice,
    };
  }

  public async ensureDeviceRegistration(force = false): Promise<void> {
    await this.getAuthSession();
    const status = await this.getStatus();
    if (!status.authenticated) {
      throw new Error('Cloud browser session is not authenticated');
    }

    if (!force && status.device && status.deviceTokenAvailable) {
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

  private async withDeviceToken<T>(
    operation: (deviceToken: string) => Promise<T>
  ): Promise<{ result: T; reRegisteredDevice: boolean }> {
    let reRegisteredDevice = false;
    let deviceToken = (await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY)) as string | undefined;

    if (!deviceToken) {
      await this.ensureDeviceRegistration(true);
      deviceToken = (await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY)) as string | undefined;
      reRegisteredDevice = true;
    }

    if (!deviceToken) {
      throw new Error('Cloud device token is unavailable');
    }

    try {
      return {
        result: await operation(deviceToken),
        reRegisteredDevice,
      };
    } catch (error) {
      if (!isCloudRequestError(error) || error.statusCode !== 401) {
        throw error;
      }

      const sessionUser = await this.fetchSessionUser();
      if (!sessionUser) {
        throw new Error('Cloud device token expired and browser session is unavailable', {
          cause: error,
        });
      }

      await this.ensureDeviceRegistration(true);
      deviceToken = (await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY)) as string | undefined;
      if (!deviceToken) {
        throw new Error('Failed to refresh cloud device token', {
          cause: error,
        });
      }

      reRegisteredDevice = true;
      return {
        result: await operation(deviceToken),
        reRegisteredDevice,
      };
    }
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

  private createDesktopLoginResultWaiter(provider: CloudAuthProviderId): {
    promise: Promise<DeepLinkPayload>;
    cancel: () => void;
  } {
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

  private async fetchSyncPull(deviceToken: string, cursor: number): Promise<SyncPullPayload> {
    const response = await fetch(`${CLOUD_API_BASE_URL}/api/sync/pull?cursor=${cursor}&limit=200`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
    });

    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    return (await parseJsonResponse<SyncPullPayload>(response)) ?? {};
  }

  private async fetchSyncPush(
    deviceToken: string,
    changes: Array<{
      namespace: string;
      key: string;
      value: unknown;
      deleted: boolean;
      clientUpdatedAt: string;
    }>
  ): Promise<SyncPushPayload> {
    const response = await fetch(`${CLOUD_API_BASE_URL}/api/sync/push`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${deviceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ changes }),
    });

    if (!response.ok) {
      throw await readErrorResponse(response);
    }

    return (await parseJsonResponse<SyncPushPayload>(response)) ?? {};
  }

  private async applyRemoteLanguage(language: string, updatedAt: string): Promise<void> {
    const normalizedLanguage = normalizeLanguageCode(language);
    await ProcessConfig.set('language', normalizedLanguage);
    await changeLanguage(normalizedLanguage).catch((error: unknown) => {
      console.error('[Cloud] Failed to apply pulled language in main process:', error);
    });

    ipcBridge.systemSettings.languageChanged.emit({ language: normalizedLanguage });

    const nextSyncState = applyPulledLanguage(
      (await ProcessConfig.get(CLOUD_SYNC_STATE_KEY)) as CloudStoredSyncState | undefined,
      updatedAt
    );
    await ProcessConfig.set(CLOUD_SYNC_STATE_KEY, nextSyncState);
  }

  private async clearStoredState(): Promise<void> {
    await ProcessConfig.remove(CLOUD_USER_KEY);
    await ProcessConfig.remove(CLOUD_DEVICE_KEY);
    await ProcessConfig.remove(CLOUD_DEVICE_TOKEN_KEY);
    await ProcessConfig.remove(CLOUD_SYNC_STATE_KEY);
  }

  private async emitStatusChanged(status?: CloudStatus): Promise<void> {
    const nextStatus = status ?? (await this.getStatus());
    ipcBridge.cloud.statusChanged.emit(nextStatus);
  }

  private async initializeAfterReady(): Promise<void> {
    await app.whenReady();
    await this.emitStatusChanged();
    await this.officialRemoteTunnelService.reconcile('cloud-init');

    const deviceToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    if (!deviceToken) {
      return;
    }

    await this.syncManagedInfermeshProvider().catch((error: unknown) => {
      console.warn('[Cloud] Initial InferMesh provider sync failed:', error);
    });
    await this.syncNow().catch((error: unknown) => {
      console.warn('[Cloud] Initial sync skipped:', error);
    });
    await this.officialRemoteTunnelService.reconcile('cloud-init-sync');
  }

  private async syncManagedInfermeshProvider(): Promise<void> {
    const deviceToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    if (typeof deviceToken !== 'string' || deviceToken.trim() === '') {
      return;
    }

    await this.infermeshProviderSyncService.syncFromDeviceToken(deviceToken);
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
