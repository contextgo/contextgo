/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getHostBrowserEntryService } from './HostBrowserEntryService';
import {
  getHostLocalClientAccessPreferences,
  getPreferredHostBrowserEntryPort,
  rememberHostBrowserEntryPort,
} from './hostBrowserEntryPreferences';
import { ProcessConfig } from '@process/utils/initStorage';

const CLOUD_DEVICE_TOKEN_KEY = 'cloud.deviceToken';

export const restoreDesktopHostBrowserEntryFromPreferences = async (): Promise<void> => {
  try {
    const preferences = await getHostLocalClientAccessPreferences();
    if (!preferences.enabled) {
      return;
    }

    const instance = await getHostBrowserEntryService().ensureForDemand('local-client', {
      preferredPort: preferences.preferredPort,
      allowRemote: preferences.allowRemote,
      reason: 'desktop-preferences',
    });

    console.log(
      `[HostBrowserEntry] Auto-restored local client demand from desktop preferences (port=${instance.port}, allowRemote=${instance.allowRemote})`
    );
  } catch (error) {
    console.error('[HostBrowserEntry] Failed to auto-restore local client demand from desktop preferences:', error);
  }
};

export const prepareOfficialRemoteHostBrowserEntryAtStartup = async (): Promise<void> => {
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
};

export const prepareHostBrowserEntryForWebUiMode = async (options: {
  preferredPort: number;
  allowRemote: boolean;
}): Promise<void> => {
  await getHostBrowserEntryService().ensureForDemand('local-client', {
    preferredPort: options.preferredPort,
    allowRemote: options.allowRemote,
    reason: 'electron-webui-mode',
  });
};
