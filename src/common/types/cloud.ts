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
  status: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string | null;
  lastIpAddress?: string | null;
  lastUserAgent?: string | null;
};

export type CloudStoredSyncState = {
  cursor?: number;
  languageUpdatedAt?: string;
  syncedLanguageUpdatedAt?: string;
  lastSyncAt?: string;
};

export type CloudSyncState = {
  cursor: number;
  languageUpdatedAt?: string;
  syncedLanguageUpdatedAt?: string;
  lastSyncAt?: string;
  pendingLanguageSync: boolean;
};

export type OfficialRemoteStatus = {
  desired: boolean;
  running: boolean;
  transport?: 'cloud-relay';
  relayUrl?: string;
  clientConnected?: boolean;
  message?: string;
  needsAttention?: boolean;
};

export type CloudStatus = {
  authenticated: boolean;
  browserSessionExpired: boolean;
  user: CloudUser | null;
  device: CloudDevice | null;
  deviceTokenAvailable: boolean;
  officialRemote: OfficialRemoteStatus;
  providers: CloudAuthProviderId[];
  authBaseUrl: string;
  apiBaseUrl: string;
  syncState: CloudSyncState;
};

export type CloudSyncSummary = {
  status: CloudStatus;
  pushedChanges: number;
  pulledChanges: number;
  reRegisteredDevice: boolean;
};
