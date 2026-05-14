/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { HostRuntimeClientSurface, HostRuntimeMode, HostRuntimePlatform } from '@/common/types/cloud';

const HEADLESS_HOST_SUPPORTED_CLIENTS: HostRuntimeClientSurface[] = ['mobile-client', 'browser-client'];
const GUI_HOST_SUPPORTED_CLIENTS: HostRuntimeClientSurface[] = ['desktop-client', 'mobile-client', 'browser-client'];

export const resolveHostRuntimePlatform = (devicePlatform?: string | null): HostRuntimePlatform => {
  if (devicePlatform === 'macos') {
    return 'macos';
  }
  if (devicePlatform === 'windows') {
    return 'windows';
  }
  if (devicePlatform === 'linux') {
    return 'linux';
  }

  switch (process.platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return 'linux';
  }
};

export const resolveHostRuntimeMode = (): HostRuntimeMode => {
  return process.argv.includes('--webui') ? 'headless-host' : 'gui-host';
};

export const getHostRuntimeSupportedClients = (mode: HostRuntimeMode): HostRuntimeClientSurface[] => {
  return mode === 'headless-host' ? [...HEADLESS_HOST_SUPPORTED_CLIENTS] : [...GUI_HOST_SUPPORTED_CLIENTS];
};
