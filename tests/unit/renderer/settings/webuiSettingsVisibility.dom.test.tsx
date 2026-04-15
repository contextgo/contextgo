import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cloudGetStatusInvoke = vi.fn();
const cloudStatusChangedOn = vi.fn();
const webuiGetStatusInvoke = vi.fn();
const webuiStatusChangedOn = vi.fn();
const webuiResetPasswordResultOn = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

vi.mock('@/renderer/components/base/ContextGoScrollArea', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/settings', () => ({
  SettingsSubModal: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/base/ContextGoModal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible?: boolean; children?: React.ReactNode }) =>
    visible ? <div>{children}</div> : null,
}));

vi.mock('@/renderer/components/settings/SettingsModal/settingsViewContext', () => ({
  useSettingsViewMode: () => 'modal',
}));

vi.mock('@/renderer/utils/officialRemote', async () => {
  const actual = await vi.importActual<typeof import('@/renderer/utils/officialRemote')>(
    '@/renderer/utils/officialRemote'
  );
  return {
    ...actual,
    dispatchOfficialRemoteSwitcherEvent: vi.fn(),
  };
});

vi.mock('@/renderer/utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@/renderer/utils/platform')>('@/renderer/utils/platform');
  return {
    ...actual,
    openExternalUrl: vi.fn(async () => undefined),
  };
});

vi.mock('@/common/adapter/ipcBridge', () => ({
  cloud: {
    ensureOfficialRemoteReady: {
      invoke: vi.fn(async () => ({ success: true, data: null })),
    },
    getStatus: {
      invoke: (...args: unknown[]) => cloudGetStatusInvoke(...args),
    },
    startLogin: {
      invoke: vi.fn(async () => ({ success: true, data: null })),
    },
    statusChanged: {
      on: (...args: unknown[]) => cloudStatusChangedOn(...args),
    },
  },
  shell: {
    openExternal: {
      invoke: vi.fn(async () => undefined),
    },
  },
  webui: {
    changePassword: {
      invoke: vi.fn(async () => ({ success: true })),
    },
    changeUsername: {
      invoke: vi.fn(async () => ({ success: true })),
    },
    generateQRToken: {
      invoke: vi.fn(async () => ({ success: true })),
    },
    getStatus: {
      invoke: (...args: unknown[]) => webuiGetStatusInvoke(...args),
    },
    resetPasswordResult: {
      on: (...args: unknown[]) => webuiResetPasswordResultOn(...args),
    },
    start: {
      invoke: vi.fn(async () => ({ success: true })),
    },
    statusChanged: {
      on: (...args: unknown[]) => webuiStatusChangedOn(...args),
    },
    stop: {
      invoke: vi.fn(async () => ({ success: true })),
    },
    updatePreferences: {
      invoke: vi.fn(async () => ({ success: true })),
    },
  },
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type='button' onClick={onClick}>
      {children}
    </button>
  ),
  Form: Object.assign(({ children }: { children?: React.ReactNode }) => <form>{children}</form>, {
    Item: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    useForm: () => [
      {
        getFieldValue: vi.fn(),
        resetFields: vi.fn(),
        setFieldsValue: vi.fn(),
        validate: vi.fn(async () => ({})),
      },
    ],
  }),
  Input: Object.assign(({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />, {
    Password: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
  }),
  Message: {
    error: vi.fn(),
    success: vi.fn(),
  },
  Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
    <button type='button' aria-pressed={checked} onClick={() => onChange?.(!checked)}>
      switch
    </button>
  ),
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

describe('WebUI settings visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webuiStatusChangedOn.mockImplementation(() => () => undefined);
    webuiResetPasswordResultOn.mockImplementation(() => () => undefined);
    cloudStatusChangedOn.mockImplementation(() => () => undefined);
    webuiGetStatusInvoke.mockResolvedValue({
      success: true,
      data: {
        adminUsername: 'admin',
        allowRemote: true,
        localAccessAllowRemote: true,
        localAccessEnabled: true,
        localUrl: 'http://localhost:3000',
        port: 3000,
        running: true,
      },
    });
    cloudGetStatusInvoke.mockResolvedValue({
      success: true,
      data: {
        apiBaseUrl: 'https://api.contextgo.io',
        authBaseUrl: 'https://auth.contextgo.io',
        authenticated: true,
        browserSessionExpired: false,
        device: {
          createdAt: '2026-04-01T00:00:00Z',
          deviceName: 'ContextGo on dev-host',
          id: 'device-1',
          platform: 'macos',
          status: 'active',
          updatedAt: '2026-04-01T00:00:00Z',
          userId: 'user-1',
        },
        deviceTokenAvailable: true,
        officialRemote: {
          browserEntryReady: true,
          desired: true,
          running: true,
          transport: 'cloud-relay',
        },
        officialRemoteReady: true,
        providers: ['github', 'google'],
        user: {
          avatarUrl: null,
          displayName: 'Dev User',
          email: 'dev@example.com',
          id: 'user-1',
          username: 'dev-user',
        },
      },
    });
  });

  it('shows Official Remote management but hides local browser-entry controls', async () => {
    const { default: WebuiModalContent } =
      await import('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent');

    render(<WebuiModalContent />);

    expect(await screen.findByText('settings.webui.officialRemoteTitle')).toBeInTheDocument();
    expect(screen.queryByText('settings.webui.localAccessTitle')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.webui.enable')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.webui.allowRemote')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.webui.accessUrl')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.webui.loginInfo')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.webui.initialPassword')).not.toBeInTheDocument();
    expect(screen.queryByText('settings.webui.qrLogin')).not.toBeInTheDocument();
  });
});
