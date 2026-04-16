/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProcessConfig } from '@process/utils/initStorage';
import { getPreferredDesktopWebUIPort, resolvePreferredDesktopWebUIPort } from '@process/utils/webuiConfig';

const DESKTOP_WEBUI_ENABLED_KEY = 'webui.desktop.enabled';
const DESKTOP_WEBUI_ALLOW_REMOTE_KEY = 'webui.desktop.allowRemote';
const DESKTOP_WEBUI_PORT_KEY = 'webui.desktop.port';
const HOST_RUNTIME_LOCAL_ACCESS_ENABLED_KEY = 'host.runtime.localAccess.enabled';
const HOST_RUNTIME_LOCAL_ACCESS_ALLOW_REMOTE_KEY = 'host.runtime.localAccess.allowRemote';
const HOST_RUNTIME_LOCAL_ACCESS_PORT_KEY = 'host.runtime.localAccess.port';

export type HostLocalClientAccessPreferences = {
  enabled: boolean;
  allowRemote: boolean;
  preferredPort: number;
};

export type HostLocalClientAccessPreferenceUpdate = {
  enabled?: boolean;
  allowRemote?: boolean;
  port?: number;
};

export const getHostLocalClientAccessPreferences = async (): Promise<HostLocalClientAccessPreferences> => {
  const [enabledValue, allowRemoteValue, portValue, legacyEnabledValue, legacyAllowRemoteValue, legacyPortValue] =
    await Promise.all([
      ProcessConfig.get(HOST_RUNTIME_LOCAL_ACCESS_ENABLED_KEY),
      ProcessConfig.get(HOST_RUNTIME_LOCAL_ACCESS_ALLOW_REMOTE_KEY),
      ProcessConfig.get(HOST_RUNTIME_LOCAL_ACCESS_PORT_KEY),
      ProcessConfig.get(DESKTOP_WEBUI_ENABLED_KEY),
      ProcessConfig.get(DESKTOP_WEBUI_ALLOW_REMOTE_KEY),
      ProcessConfig.get(DESKTOP_WEBUI_PORT_KEY),
    ]);

  return {
    enabled: (enabledValue ?? legacyEnabledValue) === true,
    allowRemote: (allowRemoteValue ?? legacyAllowRemoteValue) === true,
    preferredPort: resolvePreferredDesktopWebUIPort(portValue ?? legacyPortValue),
  };
};

export const updateHostLocalClientAccessPreferences = async (
  preferences: HostLocalClientAccessPreferenceUpdate
): Promise<void> => {
  const writes: Array<Promise<unknown>> = [];

  if (typeof preferences.enabled === 'boolean') {
    writes.push(ProcessConfig.set(HOST_RUNTIME_LOCAL_ACCESS_ENABLED_KEY, preferences.enabled));
  }
  if (typeof preferences.allowRemote === 'boolean') {
    writes.push(ProcessConfig.set(HOST_RUNTIME_LOCAL_ACCESS_ALLOW_REMOTE_KEY, preferences.allowRemote));
  }
  if (typeof preferences.port === 'number' && Number.isFinite(preferences.port) && preferences.port > 0) {
    writes.push(ProcessConfig.set(HOST_RUNTIME_LOCAL_ACCESS_PORT_KEY, preferences.port));
  }

  await Promise.all(writes);
};

export const getPreferredHostBrowserEntryPort = async (): Promise<number> => {
  return getPreferredDesktopWebUIPort();
};

export const rememberHostBrowserEntryPort = async (port: number): Promise<void> => {
  await updateHostLocalClientAccessPreferences({ port });
};
