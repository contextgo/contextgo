import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudStatus } from '@/common/types/cloud';

const getStatusInvoke = vi.fn();
const startLoginInvoke = vi.fn();
const logoutInvoke = vi.fn();
const syncNowInvoke = vi.fn();
const statusChangedOn = vi.fn();

const translations: Record<string, string> = {
  'common.refresh': 'Refresh',
  'settings.cloud.title': 'ContextGo Account',
  'settings.cloud.description': 'Cloud account section',
  'settings.cloud.loading': 'Checking cloud account status...',
  'settings.cloud.loginWithGithub': 'Continue with GitHub',
  'settings.cloud.loginWithGoogle': 'Continue with Google',
  'settings.cloud.loginSuccess': 'Cloud account connected',
  'settings.cloud.logoutSuccess': 'Cloud account disconnected',
  'settings.cloud.syncSuccess': 'Cloud data synced',
  'settings.cloud.actionFailed': 'The cloud action could not be completed',
  'settings.cloud.notConnected': 'Not connected',
  'settings.cloud.notConnectedDesc': 'Sign in to continue',
  'settings.cloud.sessionActive': 'Browser session active',
  'settings.cloud.sessionExpired': 'Browser session expired',
  'settings.cloud.sessionExpiredDesc': 'Session expired',
  'settings.cloud.deviceLinked': 'Device linked',
  'settings.cloud.deviceMissing': 'Device not linked',
  'settings.cloud.pendingSync': 'Pending sync',
  'settings.cloud.deviceName': 'Device',
  'settings.cloud.lastSync': 'Last sync',
  'settings.cloud.notSyncedYet': 'Not synced yet',
  'settings.cloud.notAvailable': 'Not available',
  'settings.cloud.syncNow': 'Sync now',
  'settings.cloud.signOut': 'Sign out',
};

const unauthenticatedStatus: CloudStatus = {
  authenticated: false,
  browserSessionExpired: false,
  user: null,
  device: null,
  deviceTokenAvailable: false,
  providers: ['github', 'google'],
  authBaseUrl: 'https://auth.contextgo.io',
  apiBaseUrl: 'https://api.contextgo.io',
  syncState: {
    cursor: 0,
    pendingLanguageSync: false,
  },
};

const authenticatedStatus: CloudStatus = {
  authenticated: true,
  browserSessionExpired: false,
  user: {
    id: 'user-1',
    email: 'yeyitech@gmail.com',
    username: 'yeyitech',
    displayName: 'yeyitech',
    avatarUrl: null,
  },
  device: {
    id: 'device-1',
    userId: 'user-1',
    deviceName: 'ContextGo on mbp',
    platform: 'macos',
    status: 'active',
    createdAt: '2026-03-28T10:00:00.000Z',
    updatedAt: '2026-03-28T10:00:00.000Z',
    lastSeenAt: '2026-03-28T10:00:00.000Z',
  },
  deviceTokenAvailable: true,
  providers: ['github', 'google'],
  authBaseUrl: 'https://auth.contextgo.io',
  apiBaseUrl: 'https://api.contextgo.io',
  syncState: {
    cursor: 5,
    lastSyncAt: '2026-03-28T10:00:00.000Z',
    pendingLanguageSync: false,
  },
};

vi.mock('@/common/adapter/ipcBridge', () => ({
  cloud: {
    getStatus: {
      invoke: getStatusInvoke,
    },
    startLogin: {
      invoke: startLoginInvoke,
    },
    logout: {
      invoke: logoutInvoke,
    },
    syncNow: {
      invoke: syncNowInvoke,
    },
    statusChanged: {
      on: statusChangedOn,
    },
  },
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
  }),
}));

describe('CloudSyncSection', () => {
  beforeEach(() => {
    getStatusInvoke.mockReset();
    startLoginInvoke.mockReset();
    logoutInvoke.mockReset();
    syncNowInvoke.mockReset();
    statusChangedOn.mockReset();
    statusChangedOn.mockImplementation(() => () => undefined);
  });

  it('renders GitHub and Google login actions when no cloud user is connected', async () => {
    getStatusInvoke.mockResolvedValue({
      success: true,
      data: unauthenticatedStatus,
    });

    const { default: CloudSyncSection } =
      await import('@/renderer/components/settings/SettingsModal/contents/SystemModalContent/CloudSyncSection');

    render(<CloudSyncSection />);

    expect(await screen.findByText('Continue with GitHub')).toBeInTheDocument();
    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
    expect(getStatusInvoke).toHaveBeenCalledTimes(1);
  });

  it('shows the bound device and triggers sync for an authenticated user', async () => {
    getStatusInvoke.mockResolvedValue({
      success: true,
      data: authenticatedStatus,
    });
    syncNowInvoke.mockResolvedValue({
      success: true,
      data: {
        status: authenticatedStatus,
        pushedChanges: 1,
        pulledChanges: 0,
        reRegisteredDevice: false,
      },
    });

    const { default: CloudSyncSection } =
      await import('@/renderer/components/settings/SettingsModal/contents/SystemModalContent/CloudSyncSection');

    render(<CloudSyncSection />);

    expect(await screen.findByText('ContextGo on mbp')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }));

    await waitFor(() => {
      expect(syncNowInvoke).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Device linked')).toBeInTheDocument();
  });
});
