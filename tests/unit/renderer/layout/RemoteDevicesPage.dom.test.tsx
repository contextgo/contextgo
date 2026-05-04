import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
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
let autoFinishWebviewLoad = true;
let latestOnDidFinishLoad: (() => void) | undefined;
let latestOnDidFailLoad: ((errorCode: number, errorDescription: string) => void) | undefined;

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
    onDidFailLoad,
    onUrlChange,
  }: {
    url: string;
    showNavBar?: boolean;
    onDidFinishLoad?: () => void;
    onDidFailLoad?: (errorCode: number, errorDescription: string) => void;
    onUrlChange?: (url: string) => void;
  }) => {
    webviewHostRender({ url, showNavBar });
    latestOnDidFinishLoad = onDidFinishLoad;
    latestOnDidFailLoad = onDidFailLoad;
    React.useEffect(() => {
      onUrlChange?.(hostedSurfaceRedirectUrl ?? url);
      if (autoFinishWebviewLoad) {
        onDidFinishLoad?.();
      }
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
        return 'Official Host List';
      }
      if (key === 'settings.webui.remoteDevicesNav') {
        return 'Remote Hosts';
      }
      if (key === 'settings.cloud.deviceName') {
        return 'Remote host';
      }
      if (key === 'settings.webui.remoteDeviceLoadFailedReason') {
        return `Loading failed: ${String(options?.reason ?? '')}`;
      }
      if (key === 'common.retry') {
        return 'Retry';
      }
      if (key === 'common.error') {
        return 'Error';
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
    autoFinishWebviewLoad = true;
    latestOnDidFinishLoad = undefined;
    latestOnDidFailLoad = undefined;
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
        'https://remote.contextgo.test/device/device-42?client=desktop-host'
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId('official-remote-loading-overlay')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('webview-host')).toHaveAttribute('data-navbar', 'false');
    expect(screen.getByTestId('webview-host').parentElement).toHaveClass('official-remote-device-shell');
    expect(screen.getByTestId('webview-host').parentElement).not.toHaveClass('rounded-18px');
    expect(remoteAccessSetTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'remote-host-shell',
        currentUrl: 'https://remote.contextgo.test/device/device-42?client=desktop-host',
      })
    );
  });

  it('shows the desktop remote opening overlay until the hosted surface finishes loading', async () => {
    autoFinishWebviewLoad = false;

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(screen.getByTestId('official-remote-loading-overlay')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('webview-host')).toHaveAttribute(
        'data-url',
        'https://remote.contextgo.test/device/device-42?client=desktop-host'
      );
    });

    await act(async () => {
      latestOnDidFinishLoad?.();
    });

    expect(screen.getByTestId('official-remote-loading-overlay')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByTestId('official-remote-loading-overlay')).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('shows a recoverable error overlay instead of a blank screen when the hosted remote surface fails to load', async () => {
    autoFinishWebviewLoad = false;

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(screen.getByTestId('official-remote-loading-overlay')).toBeInTheDocument();
    });

    await act(async () => {
      latestOnDidFailLoad?.(-105, 'ERR_NAME_NOT_RESOLVED');
    });

    await waitFor(() => {
      expect(screen.getByTestId('official-remote-error-overlay')).toBeInTheDocument();
    });

    expect(screen.getByText('Unable to open the remote device')).toBeInTheDocument();
    expect(screen.getByText('Loading failed: ERR_NAME_NOT_RESOLVED (-105)')).toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'Retry' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('official-remote-loading-overlay')).toBeInTheDocument();
    });

    await act(async () => {
      latestOnDidFailLoad?.(-105, 'ERR_NAME_NOT_RESOLVED');
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back to Local' })).toBeInTheDocument();
    });

    await act(async () => {
      screen.getByRole('button', { name: 'Back to Local' }).click();
    });

    expect(navigateSpy).toHaveBeenCalledWith('/guid', { replace: true });
  });

  it('ignores benign ERR_ABORTED webview load interruptions for the hosted remote surface', async () => {
    autoFinishWebviewLoad = false;

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(screen.getByTestId('official-remote-loading-overlay')).toBeInTheDocument();
    });

    await act(async () => {
      latestOnDidFailLoad?.(-3, 'ERR_ABORTED');
    });

    expect(screen.queryByTestId('official-remote-error-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('official-remote-loading-overlay')).toBeInTheDocument();

    await act(async () => {
      latestOnDidFinishLoad?.();
    });

    expect(screen.getByTestId('official-remote-loading-overlay')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(screen.queryByTestId('official-remote-loading-overlay')).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('switches the outer route back to picker view when the hosted desktop intentionally returns to the cloud device list', async () => {
    hostedSurfaceRedirectUrl = 'https://remote.contextgo.test/remote/devices';

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/remote/devices?view=list', { replace: true });
    });
  });

  it('returns to the local desktop when the hosted remote surface reports that the remote device went offline', async () => {
    hostedSurfaceRedirectUrl = 'https://remote.contextgo.test/remote/devices?remoteNotice=device_offline';

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/guid', { replace: true });
    });
  });

  it('returns to the local desktop when the hosted remote page requests another device via hash routing', async () => {
    hostedSurfaceRedirectUrl = 'https://remote.contextgo.test/device/device-42#/remote/devices?deviceId=device-99';

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/guid', { replace: true });
    });
  });

  it('returns to the local desktop when the hosted remote page jumps directly to another device session', async () => {
    hostedSurfaceRedirectUrl = 'https://remote.contextgo.test/device/device-99';

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/guid', { replace: true });
    });
  });

  it('returns to the hosted device list on mobile when the hosted remote page requests another device', async () => {
    isDesktopRuntimeMock = false;
    hostedSurfaceRedirectUrl = 'https://remote.contextgo.test/device/device-42#/remote/devices?deviceId=device-99';

    renderPage('/remote/devices?deviceId=device-42');

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledWith('/remote/devices?view=list', { replace: true });
    });

    expect(remoteAccessResetToDeviceList).toHaveBeenCalled();
  });

  it('keeps the hosted device-list shell when picker view is requested', async () => {
    renderPage('/remote/devices?view=list');

    await waitFor(() => {
      expect(screen.getByTestId('webview-host')).toHaveAttribute(
        'data-url',
        'https://remote.contextgo.test/remote/devices?view=list'
      );
    });

    expect(screen.getByText('Official Host List')).toBeInTheDocument();
    expect(screen.getByTestId('webview-host')).toHaveAttribute('data-navbar', 'true');
    expect(remoteAccessSetTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'device-list',
      })
    );
  });

  it('keeps the hosted list visible on mobile when picker view also carries a device id', async () => {
    isDesktopRuntimeMock = false;

    renderPage('/remote/devices?deviceId=device-42&view=list');

    await waitFor(() => {
      expect(screen.getByTestId('webview-host')).toHaveAttribute(
        'data-url',
        'https://remote.contextgo.test/remote/devices?view=list'
      );
    });

    expect(navigateSpy).not.toHaveBeenCalledWith('/remote/devices?deviceId=device-42', { replace: true });

    expect(remoteAccessSetTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'device-list',
        currentUrl: 'https://remote.contextgo.test/remote/devices?view=list',
      })
    );
  });
});
