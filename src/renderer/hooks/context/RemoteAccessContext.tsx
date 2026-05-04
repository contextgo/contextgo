/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { extractRemoteDeviceId } from '@/common/adapter/browserAuthRedirect';
import { buildOfficialDeviceListUrl, buildOfficialDeviceUrl } from '@/renderer/utils/officialRemote';
import React from 'react';

export type RemoteAccessTarget = {
  mode: 'local' | 'device-list' | 'remote-host-shell' | 'remote-device';
  currentUrl: string;
  entryUrl: string;
};

export interface RemoteAccessContextValue {
  target: RemoteAccessTarget;
  setTarget: React.Dispatch<React.SetStateAction<RemoteAccessTarget>>;
  resetToDeviceList: () => void;
}

export const createDefaultRemoteAccessTarget = (currentHref?: string): RemoteAccessTarget => {
  const resolvedHref =
    currentHref ??
    (typeof window !== 'undefined' && typeof window.location?.href === 'string' ? window.location.href : null);
  if (!resolvedHref) {
    return {
      mode: 'local',
      currentUrl: '',
      entryUrl: '',
    };
  }

  try {
    const hostedRemoteDeviceId = extractRemoteDeviceId(resolvedHref);
    if (!hostedRemoteDeviceId) {
      return {
        mode: 'local',
        currentUrl: '',
        entryUrl: '',
      };
    }

    const currentUrl = new URL(resolvedHref);
    return {
      mode: 'remote-device',
      currentUrl: buildOfficialDeviceUrl(currentUrl.origin, hostedRemoteDeviceId),
      entryUrl: buildOfficialDeviceListUrl(currentUrl.origin),
    };
  } catch {
    return {
      mode: 'local',
      currentUrl: '',
      entryUrl: '',
    };
  }
};

export const RemoteAccessContext = React.createContext<RemoteAccessContextValue | null>(null);

export function useRemoteAccessContext(): RemoteAccessContextValue | null {
  return React.useContext(RemoteAccessContext);
}
