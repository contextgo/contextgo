import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudStatus } from '@/common/types/cloud';

const cloudGetStatusInvoke = vi.fn();
const cloudStatusChangedOn = vi.fn();
const remoteAccessSetTarget = vi.fn();
const remoteAccessResetToDeviceList = vi.fn();
const webviewHostRender = vi.fn();
const navigateSpy = vi.fn();
let isDesktopRuntimeMock = true;
let hostedSurfaceRedirectUrl: string | null = null;

vi.mock('@/common/adapter/ipcBridge', () => ({
  cloud: {
    getStatus: {
      invoke: (...args: unknown[]) => cloudGetStatusInvoke(...args),
    },
    statusChanged: {
      on: (...args: unknown[]) => cloudStatusChangedOn(...args),
    },
  },
}));

vi.mock('@/renderer/components/media/WebviewHost', () => ({
  __esModule: true,
  default: ({
    url,
    showNavBar = false,
    onDidFinishLoad,
    onUrlChange,
  }: {
    url: string;
    showNavBar?: boolean;
    onDidFinishLoad?: () => void;
    onUrlChange?: (url: string) => void;
  }) => {
    webviewHostRender({ url, showNavBar });
    React.useEffect(() => {
      onUrlChange?.(hostedSurfaceRedirectUrl ?? url);
      onDidFinishLoad?.();
    }, [onDidFinishLoad, onUrlChange, url]);

    return <div data-testid='webview-host' data-url={url} data-navbar={showNavBar ? 'true' : 'false'} />;
  },
}));

vi.mock('@/renderer/hooks/context/RemoteAccessContext', () => ({
  useRemoteAccessContext: () => ({
    target: {
      mode: 'local',
      currentUrl: '',
      entryUrl: '',
    },
    setTarget: remoteAccessSetTarget,
    resetToDeviceList: remoteAccessResetToDeviceList,
  }),
}));

vi.mock('@/renderer/utils/platform', () => ({
  isElectronDesktop: () => isDesktopRuntimeMock,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'settings.webui.officialRemoteTitle') {
        return 'Official Device List';
      }
      if (key === 'settings.webui.remoteDevicesNav') {
        return 'Remote Devices';
      }
      if (key === 'settings.cloud.deviceName') {
        return 'Device';
      }
      return String(options?.defaultValue ?? key);
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
}));

import RemoteDevicesPage from '@/renderer/pages/RemoteDevicesPage';

const cloudStatus: CloudStatus = {
  authenticated: true,
  browserSessionExpired: false,
  user: {
    id: 'user-1',
    email: 'dev@example.com',
    username: 'dev',
    displayName: 'Dev',
  },
  device: {
    id: 'device-local',
    userId: 'user-1',
    deviceName: 'Local Mac',
    platform: 'macos',
    status: 'active',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
  },
  deviceTokenAvailable: true,
  officialRemote: {
    desired: true,
    running: true,
    browserEntryReady: true,
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
  authBaseUrl: 'https://remote.contextgo.test',
  apiBaseUrl: 'https://api.contextgo.test',
};

const renderPage = (entry: string) => {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path='/remote/devices' element={<RemoteDevicesPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('RemoteDevicesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDesktopRuntimeMock = true;
    hostedSurfaceRedirectUrl = null;
    cloudGetStatusInvoke.mockResolvedValue({ success: true, data: cloudStatus });
    cloudStatusChangedOn.mockImplementation(() => () => undefined);
  });

  it('returns to the local shell on desktop when the requested device is the current device', async () => {
    renderPage('/remote/devices?deviceId=device-local');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/guid', { replace: true });
    });

    expect(screen.queryByTestId('webview-host')).not.toBeInTheDocument();
    expect(remoteAccessSetTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'local',
      })
    );
  });

  it('renders a full-bleed remote surface on desktop when a specific device is requested', async () => {
    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(screen.getByTestId('webview-host')).toHaveAttribute(
        'data-url',
        'https://remote.contextgo.test/device/device-42'
      );
    });

    expect(screen.getByTestId('webview-host')).toHaveAttribute('data-navbar', 'false');
    expect(screen.queryByText('Official Device List')).not.toBeInTheDocument();
    expect(remoteAccessSetTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'remote-device',
        currentUrl: 'https://remote.contextgo.test/device/device-42',
      })
    );
  });

  it('switches the outer route back to picker view when the hosted desktop falls back to the cloud device list', async () => {
    hostedSurfaceRedirectUrl = 'https://remote.contextgo.test/remote/devices';

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/remote/devices?view=list', { replace: true });
    });
  });

  it('lets the outer desktop shell take over when the hosted remote page requests another device via hash routing', async () => {
    hostedSurfaceRedirectUrl = 'https://remote.contextgo.test/device/device-42#/remote/devices?deviceId=device-99';

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/remote/devices?deviceId=device-99', { replace: true });
    });
  });

  it('lets the outer desktop shell take over when the hosted remote page jumps directly to another device session', async () => {
    hostedSurfaceRedirectUrl = 'https://remote.contextgo.test/device/device-99';

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/remote/devices?deviceId=device-99', { replace: true });
    });
  });

  it('keeps the hosted device-list shell when picker view is requested', async () => {
    renderPage('/remote/devices?view=list');

    await waitFor(() => {
      expect(screen.getByTestId('webview-host')).toHaveAttribute(
        'data-url',
        'https://remote.contextgo.test/remote/devices?view=list'
      );
    });

    expect(screen.getByText('Official Device List')).toBeInTheDocument();
    expect(screen.getByTestId('webview-host')).toHaveAttribute('data-navbar', 'true');
    expect(remoteAccessSetTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'device-list',
      })
    );
  });

  it('stages mobile device switching through the hosted device list before opening the next device', async () => {
    isDesktopRuntimeMock = false;

    renderPage('/remote/devices?deviceId=device-42&view=list');

    await waitFor(() => {
      expect(screen.getByTestId('webview-host')).toHaveAttribute(
        'data-url',
        'https://remote.contextgo.test/remote/devices?view=list'
      );
    });

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/remote/devices?deviceId=device-42', { replace: true });
    });

    expect(remoteAccessSetTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'device-list',
        currentUrl: 'https://remote.contextgo.test/remote/devices?view=list',
      })
    );
  });
});
