import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudStatus } from '@/common/types/cloud';

const getStatusInvoke = vi.fn();
const startLoginInvoke = vi.fn();
const logoutInvoke = vi.fn();
const openInfermeshInvoke = vi.fn();
const statusChangedOn = vi.fn();
const messageSuccess = vi.fn();
const messageError = vi.fn();
const webuiGetStatusInvoke = vi.fn();
const webuiStatusChangedOn = vi.fn();
const webuiResetPasswordResultOn = vi.fn();
const configStorageGet = vi.fn();

const translations: Record<string, string> = {
  'common.refresh': 'Refresh',
  'settings.cloud.title': 'ContextGo Account',
  'settings.cloud.description':
    'Sign in once with GitHub or Google so ContextGo can bind this desktop device to your account.',
  'settings.cloud.loading': 'Checking cloud account status...',
  'settings.cloud.loginWithGithub': 'Continue with GitHub',
  'settings.cloud.loginWithGoogle': 'Continue with Google',
  'settings.cloud.loginSuccess': 'Cloud account connected',
  'settings.cloud.logoutSuccess': 'Cloud account disconnected',
  'settings.cloud.actionFailed': 'The cloud action could not be completed',
  'settings.cloud.notConnected': 'Not connected',
  'settings.cloud.notConnectedDesc':
    'Use GitHub or Google sign-in to finish OAuth login and bind this desktop. If you need the full account flow, you can continue on the InferMesh website.',
  'settings.cloud.sessionActive': 'Browser session active',
  'settings.cloud.sessionExpired': 'Browser session expired',
  'settings.cloud.sessionExpiredDesc': 'Session expired',
  'settings.cloud.deviceLinked': 'Device linked',
  'settings.cloud.deviceMissing': 'Device not linked',
  'settings.cloud.deviceName': 'Device',
  'settings.cloud.notAvailable': 'Not available',
  'settings.cloud.infermeshAccess': 'InferMesh website',
  'settings.cloud.infermeshAccessDesc':
    'ContextGo only needs the OAuth login and device binding. If you still need to register or complete account setup, continue on the InferMesh website.',
  'settings.cloud.openInfermesh': 'Open InferMesh',
  'settings.cloud.signOut': 'Sign out',
  'settings.webui': 'WebUI',
  'settings.webui.description': 'WebUI description',
  'settings.webui.passwordHidden': '******',
  'settings.webui.officialRemoteTitle': 'Official Remote',
  'settings.webui.officialRemoteDesc': 'Official Remote description',
  'settings.webui.officialRemoteLoginRequired': 'Official Remote requires cloud login',
  'settings.webui.officialRemoteSignedIn': 'Signed in as {{name}}',
  'settings.webui.officialRemoteDeviceReady': 'This host runtime is linked and ready through Official Remote.',
  'settings.webui.officialRemoteDevicePending':
    'Cloud session is active. ContextGo is still linking this host runtime to Official Remote.',
  'settings.webui.officialRemoteRuntimeHint':
    'Official Remote prepares the host runtime path automatically. You do not need to enable Local & Self-Hosted Access below.',
  'settings.webui.openOfficialRemote': 'Open Official Remote',
  'settings.webui.officialRemoteSignedOut': 'Official Remote is not connected yet.',
  'settings.webui.officialRemoteHint': 'Sign in once here to enable hosted remote access for this device.',
};

const unauthenticatedStatus: CloudStatus = {
  authenticated: false,
  browserSessionExpired: false,
  user: null,
  device: null,
  deviceTokenAvailable: false,
  officialRemote: {
    desired: false,
    running: false,
  },
  hostRuntime: {
    authority: 'host-runtime',
    defaultRemoteAccess: 'official-remote',
    exposure: 'loopback',
    lifecycle: 'stopped',
    mode: 'gui-host',
    platform: 'macos',
    running: false,
    supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
    officialRemoteDesired: false,
    officialRemoteReady: false,
  },
  providers: ['github', 'google'],
  authBaseUrl: 'https://auth.contextgo.io',
  apiBaseUrl: 'https://api.contextgo.io',
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
  officialRemote: {
    desired: true,
    running: true,
  },
  hostRuntime: {
    authority: 'host-runtime',
    defaultRemoteAccess: 'official-remote',
    exposure: 'loopback',
    lifecycle: 'running',
    mode: 'gui-host',
    platform: 'macos',
    running: true,
    supportedClients: ['desktop-client', 'mobile-client', 'browser-client'],
    officialRemoteDesired: true,
    officialRemoteReady: true,
    localUrl: 'http://localhost:25809',
  },
  providers: ['github', 'google'],
  authBaseUrl: 'https://auth.contextgo.io',
  apiBaseUrl: 'https://api.contextgo.io',
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
    openInfermesh: {
      invoke: openInfermeshInvoke,
    },
    statusChanged: {
      on: statusChangedOn,
    },
  },
  webui: {
    getStatus: {
      invoke: webuiGetStatusInvoke,
    },
    statusChanged: {
      on: webuiStatusChangedOn,
    },
    resetPasswordResult: {
      on: webuiResetPasswordResultOn,
    },
  },
}));

vi.mock('@/common/config/storage', () => ({
  ConfigStorage: {
    get: (...args: unknown[]) => configStorageGet(...args),
  },
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => true,
}));

vi.mock('@/renderer/components/base/ContextGoModal', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/base/ContextGoScrollArea', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/settings/SettingsModal/settingsViewContext', () => ({
  useSettingsViewMode: () => 'page',
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Message: {
      success: messageSuccess,
      error: messageError,
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
    statusChangedOn.mockReset();
    messageSuccess.mockReset();
    messageError.mockReset();
    webuiGetStatusInvoke.mockReset();
    webuiStatusChangedOn.mockReset();
    webuiResetPasswordResultOn.mockReset();
    openInfermeshInvoke.mockReset();
    configStorageGet.mockReset();
    statusChangedOn.mockImplementation(() => () => undefined);
    webuiStatusChangedOn.mockImplementation(() => () => undefined);
    webuiResetPasswordResultOn.mockImplementation(() => () => undefined);
    openInfermeshInvoke.mockResolvedValue({ success: true, data: authenticatedStatus });
    configStorageGet.mockResolvedValue(false);
    webuiGetStatusInvoke.mockResolvedValue({
      success: true,
      data: {
        running: false,
        port: 3000,
        allowRemote: false,
        localUrl: 'http://localhost:3000',
        adminUsername: 'admin',
      },
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
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

  it('shows the bound device and infermesh entry for an authenticated user', async () => {
    getStatusInvoke.mockResolvedValue({
      success: true,
      data: authenticatedStatus,
    });

    const { default: CloudSyncSection } =
      await import('@/renderer/components/settings/SettingsModal/contents/SystemModalContent/CloudSyncSection');

    render(<CloudSyncSection />);

    expect(await screen.findByText('ContextGo on mbp')).toBeInTheDocument();
    expect(screen.getByText('Device linked')).toBeInTheDocument();
    expect(screen.getByText('InferMesh website')).toBeInTheDocument();
  });

  it('offers direct access to InferMesh before cloud login completes', async () => {
    getStatusInvoke.mockResolvedValue({
      success: true,
      data: unauthenticatedStatus,
    });

    const { default: CloudSyncSection } =
      await import('@/renderer/components/settings/SettingsModal/contents/SystemModalContent/CloudSyncSection');

    render(<CloudSyncSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open InferMesh' }));

    await waitFor(() => {
      expect(openInfermeshInvoke).toHaveBeenCalledTimes(1);
    });
  });

  it('opens the InferMesh portal after account binding is complete', async () => {
    getStatusInvoke.mockResolvedValue({
      success: true,
      data: authenticatedStatus,
    });

    const { default: CloudSyncSection } =
      await import('@/renderer/components/settings/SettingsModal/contents/SystemModalContent/CloudSyncSection');

    render(<CloudSyncSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open InferMesh' }));

    await waitFor(() => {
      expect(openInfermeshInvoke).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the returned login error message when cloud login fails', async () => {
    getStatusInvoke.mockResolvedValue({
      success: true,
      data: unauthenticatedStatus,
    });
    startLoginInvoke.mockResolvedValue({
      success: false,
      msg: 'Cloud login failed: access_denied',
    });

    const { default: CloudSyncSection } =
      await import('@/renderer/components/settings/SettingsModal/contents/SystemModalContent/CloudSyncSection');

    render(<CloudSyncSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with GitHub' }));

    await waitFor(() => {
      expect(startLoginInvoke).toHaveBeenCalledWith({ provider: 'github' });
    });
    expect(messageError).toHaveBeenCalledWith('Cloud login failed: access_denied');
  });

  it('treats a refreshed authenticated status as a successful login after the login flow closes', async () => {
    getStatusInvoke
      .mockResolvedValueOnce({
        success: true,
        data: unauthenticatedStatus,
      })
      .mockResolvedValueOnce({
        success: true,
        data: authenticatedStatus,
      });
    startLoginInvoke.mockResolvedValue({
      success: false,
      msg: 'Cloud login failed: cancelled',
    });

    const { default: CloudSyncSection } =
      await import('@/renderer/components/settings/SettingsModal/contents/SystemModalContent/CloudSyncSection');

    render(<CloudSyncSection />);

    fireEvent.click(await screen.findByRole('button', { name: 'Continue with GitHub' }));

    await waitFor(() => {
      expect(startLoginInvoke).toHaveBeenCalledWith({ provider: 'github' });
      expect(getStatusInvoke).toHaveBeenCalledTimes(2);
    });
    expect(messageSuccess).toHaveBeenCalledWith('Cloud account connected');
    expect(messageError).not.toHaveBeenCalled();
  });

  it('shows device-pending copy instead of the raw tunnel message when cloud login exists but desktop linking is incomplete', async () => {
    getStatusInvoke.mockResolvedValue({
      success: true,
      data: {
        ...authenticatedStatus,
        deviceTokenAvailable: false,
        officialRemote: {
          desired: false,
          running: false,
          message: 'Official Remote is not enabled on this desktop yet.',
        },
        hostRuntime: {
          ...authenticatedStatus.hostRuntime,
          running: false,
          lifecycle: 'stopped',
          officialRemoteDesired: false,
          officialRemoteReady: false,
          localUrl: undefined,
        },
      },
    });

    const { default: WebuiModalContent } =
      await import('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent');

    render(<WebuiModalContent />);

    expect(await screen.findByText('Signed in as {{name}}')).toBeInTheDocument();
    expect(
      screen.getByText('Cloud session is active. ContextGo is still linking this host runtime to Official Remote.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Official Remote is not enabled on this desktop yet.')).not.toBeInTheDocument();
  });
});
