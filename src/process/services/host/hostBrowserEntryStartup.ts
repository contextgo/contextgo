/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProcessConfig } from '@process/utils/initStorage';
import { getPreferredDesktopWebUIPort, resolvePreferredDesktopWebUIPort } from '@process/utils/webuiConfig';
import { getHostBrowserEntryService } from './HostBrowserEntryService';

const CLOUD_DEVICE_TOKEN_KEY = 'cloud.deviceToken';
const DESKTOP_WEBUI_ENABLED_KEY = 'webui.desktop.enabled';
const DESKTOP_WEBUI_ALLOW_REMOTE_KEY = 'webui.desktop.allowRemote';
const DESKTOP_WEBUI_PORT_KEY = 'webui.desktop.port';

export const restoreDesktopHostBrowserEntryFromPreferences = async (): Promise<void> => {
  try {
    const enabled = (await ProcessConfig.get(DESKTOP_WEBUI_ENABLED_KEY)) === true;
    if (!enabled) {
      return;
    }

    const [allowRemotePref, portPref] = await Promise.all([
      ProcessConfig.get(DESKTOP_WEBUI_ALLOW_REMOTE_KEY),
      ProcessConfig.get(DESKTOP_WEBUI_PORT_KEY),
    ]);
    const allowRemote = allowRemotePref === true;
    const preferredPort = resolvePreferredDesktopWebUIPort(portPref);
    const instance = await getHostBrowserEntryService().ensureForDemand('local-client', {
      preferredPort,
      allowRemote,
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

  const preferredPort = await getPreferredDesktopWebUIPort();
  const instance = await getHostBrowserEntryService().ensureForDemand('official-remote', {
    preferredPort,
    allowRemote: false,
    reason: 'app-startup-official-remote',
    allowPortFallback: true,
  });

  await ProcessConfig.set(DESKTOP_WEBUI_PORT_KEY, instance.port);
};
