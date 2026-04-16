/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getHostRuntimeService } from './HostRuntimeService';

export const restoreDesktopHostRuntimeFromPreferences = async (): Promise<void> => {
  try {
    await getHostRuntimeService().restoreLocalClientAccessFromPreferences();
    console.log('[HostRuntime] Auto-restored local host access demand from host runtime preferences');
  } catch (error) {
    console.error('[HostRuntime] Failed to auto-restore local host access demand:', error);
  }
};

export const prepareOfficialRemoteHostRuntimeAtStartup = async (): Promise<void> => {
  await getHostRuntimeService().prepareOfficialRemoteAtStartup();
};

export const prepareHostRuntimeForWebUiMode = async (options: {
  preferredPort: number;
  allowRemote: boolean;
}): Promise<void> => {
  await getHostRuntimeService().prepareForWebUiMode(options);
};
