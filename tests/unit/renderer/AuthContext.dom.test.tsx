/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CloudStatus } from '@/common/types/cloud';

const getStatusInvokeMock = vi.fn();
const statusChangedOnMock = vi.fn();

let statusChangedHandler: ((status: CloudStatus) => void) | null = null;

vi.mock('@/common', () => ({
  ipcBridge: {
    cloud: {
      getStatus: {
        invoke: (...args: unknown[]) => getStatusInvokeMock(...args),
      },
      statusChanged: {
        on: (...args: unknown[]) => statusChangedOnMock(...args),
      },
    },
  },
}));

vi.mock('@process/webserver/middleware/csrfClient', () => ({
  withCsrfToken: <T,>(payload: T) => payload,
}));

const authenticatedStatus: CloudStatus = {
  authenticated: true,
  browserSessionExpired: false,
  user: {
    id: 'user-1',
    username: 'yeyitech',
    displayName: 'Ye Yitech',
    email: 'yeyitech@gmail.com',
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

async function renderAuthProvider(renderSpy: ReturnType<typeof vi.fn>) {
  const authModule = await import('@/renderer/hooks/context/AuthContext');

  const Probe: React.FC = () => {
    const { ready, refresh, status, user } = authModule.useAuth();

    renderSpy({
      ready,
      status,
      user,
    });

    return (
      <div>
        <div data-testid='ready'>{String(ready)}</div>
        <div data-testid='status'>{status}</div>
        <div data-testid='display-name'>{user?.displayName ?? 'none'}</div>
        <button type='button' onClick={() => void refresh()}>
          refresh
        </button>
      </div>
    );
  };

  render(
    <authModule.AuthProvider>
      <Probe />
    </authModule.AuthProvider>
  );

  await waitFor(() => {
    expect(screen.getByTestId('ready')).toHaveTextContent('true');
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('display-name')).toHaveTextContent('Ye Yitech');
  });
}

describe('AuthProvider desktop auth state', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    statusChangedHandler = null;

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: {},
    });

    getStatusInvokeMock.mockResolvedValue({
      success: true,
      data: authenticatedStatus,
    });

    statusChangedOnMock.mockImplementation((handler: (status: CloudStatus) => void) => {
      statusChangedHandler = handler;
      return () => {
        if (statusChangedHandler === handler) {
          statusChangedHandler = null;
        }
      };
    });
  });

  afterEach(() => {
    delete (window as Window & { electronAPI?: unknown }).electronAPI;
  });

  it('does not rerender desktop auth consumers when refresh returns the same cloud user snapshot', async () => {
    const renderSpy = vi.fn();

    await renderAuthProvider(renderSpy);

    const stableRenderCount = renderSpy.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

    await waitFor(() => {
      expect(getStatusInvokeMock).toHaveBeenCalledTimes(2);
    });

    expect(renderSpy).toHaveBeenCalledTimes(stableRenderCount);
  });

  it('does not rerender desktop auth consumers when cloud status changes without changing the user snapshot', async () => {
    const renderSpy = vi.fn();

    await renderAuthProvider(renderSpy);

    const stableRenderCount = renderSpy.mock.calls.length;

    act(() => {
      statusChangedHandler?.({
        ...authenticatedStatus,
        user: {
          ...authenticatedStatus.user,
        },
        deviceTokenAvailable: false,
        officialRemote: {
          ...authenticatedStatus.officialRemote,
          running: false,
        },
        hostRuntime: {
          ...authenticatedStatus.hostRuntime,
          officialRemoteReady: false,
        },
      });
    });

    expect(renderSpy).toHaveBeenCalledTimes(stableRenderCount);
  });

  it('rerenders desktop auth consumers when the cloud user snapshot changes', async () => {
    const renderSpy = vi.fn();

    await renderAuthProvider(renderSpy);

    const stableRenderCount = renderSpy.mock.calls.length;

    act(() => {
      statusChangedHandler?.({
        ...authenticatedStatus,
        user: {
          ...authenticatedStatus.user,
          displayName: 'ContextGo Team',
          avatarUrl: 'https://cdn.contextgo.io/avatar.png',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('display-name')).toHaveTextContent('ContextGo Team');
    });

    expect(renderSpy.mock.calls.length).toBeGreaterThan(stableRenderCount);
  });
});
