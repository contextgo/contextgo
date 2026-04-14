/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export type CloudAuthProviderId = 'github' | 'google';

export type CloudUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

export type CloudDevice = {
  id: string;
  userId: string;
  deviceName: string;
  platform: string;
  deviceKind?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string | null;
  lastIpAddress?: string | null;
  lastUserAgent?: string | null;
};

export type CloudRemoteDeviceStatus = {
  connected: boolean;
  connectedAt?: string | null;
  clientConnected: boolean;
  clientConnectedAt?: string | null;
  transport?: string | null;
  browserEntryUrl?: string | null;
  browserEntryReady: boolean;
  browserEntryReason?: string | null;
};

export type CloudRemoteDevice = CloudDevice & {
  remoteStatus: CloudRemoteDeviceStatus;
};

export type CloudRemoteDeviceSelection = {
  preferredDeviceId: string | null;
  preferredSource?: string | null;
  autoOpenDeviceId: string | null;
  autoOpenReason?: string | null;
  openableDeviceCount: number;
  forcePicker: boolean;
};

export type CloudRemoteDevicesPayload = {
  devices: CloudRemoteDevice[];
  selection: CloudRemoteDeviceSelection;
};

export type OfficialRemoteStatus = {
  desired: boolean;
  running: boolean;
  transport?: 'cloud-relay';
  relayUrl?: string;
  clientConnected?: boolean;
  browserEntryReady?: boolean;
  browserEntryReason?: string;
  message?: string;
  needsAttention?: boolean;
};

export type CloudStatus = {
  officialRemoteReady?: boolean;
  authenticated: boolean;
  browserSessionExpired: boolean;
  user: CloudUser | null;
  device: CloudDevice | null;
  deviceTokenAvailable: boolean;
  officialRemote: OfficialRemoteStatus;
  providers: CloudAuthProviderId[];
  authBaseUrl: string;
  apiBaseUrl: string;
};
