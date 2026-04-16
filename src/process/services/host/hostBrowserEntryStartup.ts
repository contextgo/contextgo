/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getHostRuntimeService } from './HostRuntimeService';

export const restoreDesktopHostBrowserEntryFromPreferences = async (): Promise<void> => {
  try {
    await getHostRuntimeService().restoreLocalClientAccessFromPreferences();

    console.log(
      '[HostBrowserEntry] Auto-restored local client demand from desktop preferences through HostRuntimeService'
    );
  } catch (error) {
    console.error('[HostBrowserEntry] Failed to auto-restore local client demand from desktop preferences:', error);
  }
};

export const prepareOfficialRemoteHostBrowserEntryAtStartup = async (): Promise<void> => {
  await getHostRuntimeService().prepareOfficialRemoteAtStartup();
};

export const prepareHostBrowserEntryForWebUiMode = async (options: {
  preferredPort: number;
  allowRemote: boolean;
}): Promise<void> => {
  await getHostRuntimeService().prepareForWebUiMode(options);
};
