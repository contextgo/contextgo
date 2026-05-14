/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { WebServerInstance } from '@process/webserver';
import {
  type HostBrowserEntryDemandState,
  type HostBrowserEntryRuntimeStatus,
  type HostBrowserEntryStatusChangedEvent,
  getHostBrowserEntryService,
} from './HostBrowserEntryService';
import {
  getHostLocalClientAccessPreferences,
  getPreferredHostBrowserEntryPort,
  rememberHostBrowserEntryPort,
} from './hostBrowserEntryPreferences';
import { ProcessConfig } from '@process/utils/initStorage';

const CLOUD_DEVICE_TOKEN_KEY = 'cloud.deviceToken';

export class HostRuntimeService {
  public getRuntimeStatus(): HostBrowserEntryRuntimeStatus {
    return getHostBrowserEntryService().getRuntimeStatus();
  }

  public getCurrentInstance(): WebServerInstance | null {
    return getHostBrowserEntryService().getCurrentInstance();
  }

  public getLocalBaseUrl(): string | null {
    return getHostBrowserEntryService().getLocalBaseUrl();
  }

  public getLocalClientAccessState(): HostBrowserEntryDemandState {
    return getHostBrowserEntryService().getDemandState('local-client');
  }

  public setCurrentInstanceForLegacy(instance: WebServerInstance | null): void {
    getHostBrowserEntryService().setCurrentInstanceForLegacy(instance);
  }

  public setStatusChangedEmitter(emitter: ((status: HostBrowserEntryStatusChangedEvent) => void) | null): void {
    getHostBrowserEntryService().setStatusChangedEmitter(emitter);
  }

  public async restoreLocalClientAccessFromPreferences(): Promise<void> {
    const preferences = await getHostLocalClientAccessPreferences();
    if (!preferences.enabled) {
      return;
    }

    await getHostBrowserEntryService().ensureForDemand('local-client', {
      preferredPort: preferences.preferredPort,
      allowRemote: preferences.allowRemote,
      reason: 'desktop-preferences',
    });
  }

  public async prepareOfficialRemoteAtStartup(): Promise<void> {
    const storedOfficialRemoteToken = await ProcessConfig.get(CLOUD_DEVICE_TOKEN_KEY);
    if (typeof storedOfficialRemoteToken !== 'string' || !storedOfficialRemoteToken.trim()) {
      return;
    }

    const preferredPort = await getPreferredHostBrowserEntryPort();
    const instance = await getHostBrowserEntryService().ensureForDemand('official-remote', {
      preferredPort,
      allowRemote: false,
      reason: 'app-startup-official-remote',
      allowPortFallback: true,
    });

    await rememberHostBrowserEntryPort(instance.port);
  }

  public async prepareForWebUiMode(options: { preferredPort: number; allowRemote: boolean }): Promise<void> {
    await getHostBrowserEntryService().ensureForDemand('local-client', {
      preferredPort: options.preferredPort,
      allowRemote: options.allowRemote,
      reason: 'electron-webui-mode',
    });
  }

  public async ensureLocalClientAccess(options: {
    preferredPort: number;
    allowRemote: boolean;
    reason: string;
  }): Promise<WebServerInstance> {
    return getHostBrowserEntryService().ensureForDemand('local-client', {
      preferredPort: options.preferredPort,
      allowRemote: options.allowRemote,
      reason: options.reason,
    });
  }

  public async stopLocalClientAccess(reason: string): Promise<void> {
    await getHostBrowserEntryService().releaseDemand('local-client', reason);
  }

  public async ensureOfficialRemoteRuntime(reason: string): Promise<WebServerInstance> {
    const preferredPort = await getPreferredHostBrowserEntryPort();
    const instance = await getHostBrowserEntryService().ensureForDemand('official-remote', {
      preferredPort,
      allowRemote: false,
      reason,
      allowPortFallback: true,
    });

    await rememberHostBrowserEntryPort(instance.port);
    return instance;
  }

  public async releaseOfficialRemoteRuntime(reason: string): Promise<void> {
    await getHostBrowserEntryService().releaseDemand('official-remote', reason);
  }
}

let hostRuntimeService: HostRuntimeService | null = null;

export const getHostRuntimeService = (): HostRuntimeService => {
  if (!hostRuntimeService) {
    hostRuntimeService = new HostRuntimeService();
  }

  return hostRuntimeService;
};

export const resetHostRuntimeServiceForTests = (): void => {
  hostRuntimeService = null;
};
