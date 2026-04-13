/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export type RemoteAccessTarget = {
  mode: 'local' | 'device-list' | 'remote-device';
  currentUrl: string;
  entryUrl: string;
};

export interface RemoteAccessContextValue {
  target: RemoteAccessTarget;
  setTarget: React.Dispatch<React.SetStateAction<RemoteAccessTarget>>;
  resetToDeviceList: () => void;
}

export const createDefaultRemoteAccessTarget = (): RemoteAccessTarget => ({
  mode: 'local',
  currentUrl: '',
  entryUrl: '',
});

export const RemoteAccessContext = React.createContext<RemoteAccessContextValue | null>(null);

export function useRemoteAccessContext(): RemoteAccessContextValue | null {
  return React.useContext(RemoteAccessContext);
}
