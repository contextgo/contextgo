import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
const cloudGetStatusInvokeMock = vi.fn(async () => ({
  success: true,
  data: {
    authenticated: true,
    browserSessionExpired: false,
    user: {
      id: 'u-1',
      email: 'demo@example.com',
      username: 'demo',
      displayName: 'Demo',
    },
    device: null,
    deviceTokenAvailable: true,
    officialRemoteReady: true,
    officialRemote: {
      desired: true,
      running: true,
      browserEntryReady: true,
    },
    providers: ['github'],
    authBaseUrl: 'https://example.com',
    apiBaseUrl: 'https://api.example.com',
  },
}));
const cloudStatusChangedOnMock = vi.fn(() => () => void 0);
const listExternalSessionsInvokeMock = vi.fn(async () => ({
  success: true,
  data: {
    sessions: [{ sessionId: 's-1' }, { sessionId: 's-2' }],
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      (
        ({
          'settings.cloud.loading': 'Checking cloud account status...',
          'settings.webui.officialRemoteTitle': 'Official Remote',
          'settings.webui.officialRemoteSignedOut': 'Official Remote is not connected yet.',
          'settings.webui.officialRemoteDeviceReady': 'This device is linked and ready for Official Remote.',
          'settings.webui.officialRemoteDevicePending':
            'Cloud session is active. ContextGo is linking this device for Official Remote.',
          'settings.webui.officialRemotePreparing': 'ContextGo is preparing this desktop for Official Remote.',
          'settings.webui.officialRemoteConnecting': 'ContextGo is reconnecting this desktop to Official Remote.',
          'settings.webui.officialRemoteNeedsRelogin':
            'Official Remote needs a fresh cloud login before this desktop can reconnect.',
          'settings.webui.officialRemoteUnavailable': 'Official Remote is not ready on this desktop yet.',
          'settings.webui.officialRemoteStatusShort.checking': 'Checking',
          'settings.webui.officialRemoteStatusShort.signedOut': 'Not connected',
          'settings.webui.officialRemoteStatusShort.ready': 'Ready',
          'settings.webui.officialRemoteStatusShort.relogin': 'Sign in again',
          'settings.webui.officialRemoteStatusShort.linking': 'Linking device',
          'settings.webui.officialRemoteStatusShort.preparing': 'Preparing',
          'settings.webui.officialRemoteStatusShort.connecting': 'Connecting',
          'settings.webui.officialRemoteStatusShort.unavailable': 'Unavailable',
          'guid.externalSessions.title': 'Continue external sessions',
          'guid.externalSessions.loading': 'Scanning external sessions...',
          'guid.externalSessions.loadingShort': 'Scanning',
          'guid.externalSessions.loadFailed': 'Failed to scan external sessions.',
          'guid.externalSessions.loadFailedShort': 'Scan failed',
          'guid.externalSessions.import': 'Take over',
          'guid.externalSessions.emptyState': 'No external sessions are waiting yet.',
          'guid.externalSessions.emptyStateShort': 'None yet',
          'guid.externalSessions.readyCount': `${String(options?.count ?? '0')} sessions ready`,
          'guid.externalSessions.readyCountShort': `${String(options?.count ?? '0')} ready`,
        }) as Record<string, string>
      )[key] ?? String(options?.defaultValue ?? key),
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  cloud: {
    getStatus: {
      invoke: (...args: unknown[]) => cloudGetStatusInvokeMock(...args),
    },
    statusChanged: {
      on: (...args: unknown[]) => cloudStatusChangedOnMock(...args),
    },
  },
  acpConversation: {
    listExternalSessions: {
      invoke: (...args: unknown[]) => listExternalSessionsInvokeMock(...args),
    },
  },
}));

vi.mock('@icon-park/react', () => ({
  Earth: () => <span data-testid='earth-icon' />,
  Download: () => <span data-testid='download-icon' />,
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick, className }: React.PropsWithChildren<{ onClick?: () => void; className?: string }>) => (
    <button type='button' className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

import { LayoutContext, type LayoutContextValue } from '@/renderer/hooks/context/LayoutContext';
import QuickActionButtons from '@/renderer/pages/guid/components/QuickActionButtons';

const mobileLayoutValue: LayoutContextValue = {
  isMobile: true,
  siderCollapsed: false,
  setSiderCollapsed: vi.fn(),
};

describe('QuickActionButtons', () => {
  it('renders mobile quick actions with remote and external session status', async () => {
    const openExternalSessionsMock = vi.fn();

    render(
      <LayoutContext.Provider value={mobileLayoutValue}>
        <QuickActionButtons
          onOpenExternalSessions={openExternalSessionsMock}
          inactiveBorderColor='var(--border-base)'
          activeShadow='none'
        />
      </LayoutContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
    expect(screen.getByText('Official Remote')).toBeInTheDocument();
    expect(screen.getByText('Continue external sessions')).toBeInTheDocument();
    expect(screen.getByText('2 ready')).toBeInTheDocument();
    expect(screen.getByText('Take over')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Official Remote/i }));
    expect(navigateMock).toHaveBeenCalledWith('/remote/devices');

    fireEvent.click(screen.getByRole('button', { name: /Continue external sessions/i }));
    expect(openExternalSessionsMock).toHaveBeenCalledTimes(1);
    expect(cloudGetStatusInvokeMock).toHaveBeenCalledTimes(1);
    expect(listExternalSessionsInvokeMock).toHaveBeenCalledTimes(1);
  });
});
