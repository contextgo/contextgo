import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const webuiGetStatusInvoke = vi.fn();
const webuiStatusChangedOn = vi.fn();
const webuiResetPasswordResultOn = vi.fn();
const cloudGetStatusInvoke = vi.fn();
const cloudStatusChangedOn = vi.fn();
const cloudEnsureOfficialRemoteReadyInvoke = vi.fn();
const openExternalInvoke = vi.fn();
const webuiUpdatePreferencesInvoke = vi.fn();
const shellOpenExternalMock = vi.fn();

const translations: Record<string, string> = {
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.copy': 'Copy',
  'settings.cloud.loading': 'Checking cloud account status...',
  'settings.webui.officialRemoteSignedOut': 'Official Remote is not connected yet.',
  'settings.webui.officialRemoteHint': 'Sign in once here to enable hosted remote access for this device.',
  'settings.webui.officialRemoteRuntimeHint':
    'Official Remote prepares the desktop runtime automatically. You do not need to enable Local & Self-Hosted Access below.',
  'settings.webui.openOfficialRemote': 'Open Official Remote',
  'settings.webui.editUsernameTooltip': 'Edit username',
  'settings.webui.resetPasswordTooltip': 'Set new password',
  'settings.webui.setNewUsername': 'Set new username',
  'settings.webui.setNewPassword': 'Set new password',
  'settings.webui.newUsername': 'New username',
  'settings.webui.newUsernamePlaceholder': 'Enter username',
  'settings.webui.newPassword': 'New password',
  'settings.webui.newPasswordPlaceholder': 'Enter password',
  'settings.webui.confirmPassword': 'Confirm password',
  'settings.webui.confirmPasswordPlaceholder': 'Confirm password again',
  'settings.webui.username': 'Username',
  'settings.webui.initialPassword': 'Password',
  'settings.webui.passwordHidden': '******',
  'settings.webui.loginInfo': 'Login info',
  'settings.webui.localAccessTitle': 'Local access',
  'settings.webui.featureRemoteDesc': 'Remote access description',
  'settings.webui.enable': 'Enable WebUI',
  'settings.webui.allowRemote': 'Allow remote',
  'settings.webui.allowRemoteDesc': 'Allow remote description',
  'settings.webui.viewGuide': 'View guide',
  'settings.webui.description': 'WebUI description',
  'settings.webui.starting': 'Starting',
  'settings.webui.running': 'Running',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => translations[key] ?? key,
    i18n: { language: 'en-US' },
  }),
}));

const openExternalUrlMock = vi.fn();

vi.mock('@/renderer/utils/platform', async () => {
  const actual = await vi.importActual<typeof import('@/renderer/utils/platform')>('@/renderer/utils/platform');
  return {
    ...actual,
    openExternalUrl: (...args: unknown[]) => openExternalUrlMock(...args),
  };
});

vi.mock('@/renderer/components/settings/SettingsModal/settingsViewContext', () => ({
  useSettingsViewMode: () => 'modal',
}));

vi.mock('@/common/adapter/ipcBridge', () => ({
  cloud: {
    getStatus: {
      invoke: (...args: unknown[]) => cloudGetStatusInvoke(...args),
    },
    startLogin: {
      invoke: vi.fn(),
    },
    ensureOfficialRemoteReady: {
      invoke: (...args: unknown[]) => cloudEnsureOfficialRemoteReadyInvoke(...args),
    },
    statusChanged: {
      on: (...args: unknown[]) => cloudStatusChangedOn(...args),
    },
  },
  shell: {
    openExternal: {
      invoke: (...args: unknown[]) => openExternalInvoke(...args),
    },
  },
  webui: {
    getStatus: {
      invoke: (...args: unknown[]) => webuiGetStatusInvoke(...args),
    },
    updatePreferences: {
      invoke: (...args: unknown[]) => webuiUpdatePreferencesInvoke(...args),
    },
    statusChanged: {
      on: (...args: unknown[]) => webuiStatusChangedOn(...args),
    },
    resetPasswordResult: {
      on: (...args: unknown[]) => webuiResetPasswordResultOn(...args),
    },
    start: {
      invoke: vi.fn(),
    },
    stop: {
      invoke: vi.fn(),
    },
    changePassword: {
      invoke: vi.fn(),
    },
    changeUsername: {
      invoke: vi.fn(),
    },
    generateQRToken: {
      invoke: vi.fn(),
    },
  },
}));

vi.mock('@/renderer/components/base/ContextGoScrollArea', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/renderer/components/base/ContextGoModal', () => ({
  __esModule: true,
  default: ({
    visible,
    children,
    className,
    header,
    footer,
  }: {
    visible?: boolean;
    children?: React.ReactNode;
    className?: string;
    header?: { title?: React.ReactNode; render?: () => React.ReactNode } | React.ReactNode;
    footer?: { render?: () => React.ReactNode } | React.ReactNode | null;
  }) => {
    if (!visible) {
      return null;
    }

    const headerContent =
      typeof header === 'object' && header !== null && 'render' in header && typeof header.render === 'function'
        ? header.render()
        : typeof header === 'object' && header !== null && 'title' in header
          ? header.title
          : header;

    const footerContent =
      footer && typeof footer === 'object' && 'render' in footer && typeof footer.render === 'function'
        ? footer.render()
        : footer;

    return (
      <div data-testid='contextgo-modal' className={className}>
        <div>{headerContent}</div>
        <div>{children}</div>
        <div>{footerContent}</div>
      </div>
    );
  },
}));

vi.mock('@arco-design/web-react', () => {
  const Button = ({
    children,
    onClick,
    type = 'button',
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    type?: 'button' | 'submit' | 'reset' | 'primary' | 'secondary' | 'text';
  }) => (
    <button
      type={type === 'primary' || type === 'secondary' || type === 'text' ? 'button' : type}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );

  const InputComponent = ({ placeholder, ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input placeholder={placeholder} {...props} />
  );
  InputComponent.Password = InputComponent;

  const formApi = {
    resetFields: vi.fn(),
    setFieldsValue: vi.fn(),
    validate: vi.fn().mockResolvedValue({}),
    getFieldValue: vi.fn(),
  };

  const FormComponent = ({ children }: { children?: React.ReactNode }) => <form>{children}</form>;
  FormComponent.Item = ({ label, children }: { label?: React.ReactNode; children?: React.ReactNode }) => (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
  FormComponent.useForm = () => [formApi];

  const SelectComponent = ({ children }: { children?: React.ReactNode }) => <select>{children}</select>;
  SelectComponent.Option = ({ children, value }: { children?: React.ReactNode; value?: string }) => (
    <option value={value}>{children}</option>
  );
  SelectComponent.OptGroup = ({ children, label }: { children?: React.ReactNode; label?: React.ReactNode }) => (
    <optgroup label={typeof label === 'string' ? label : undefined}>{children}</optgroup>
  );

  const StepsComponent = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  StepsComponent.Step = ({ children, title }: { children?: React.ReactNode; title?: React.ReactNode }) => (
    <div>
      <span>{title}</span>
      {children}
    </div>
  );

  return {
    Button,
    Form: FormComponent,
    Input: InputComponent,
    Message: {
      success: vi.fn(),
      error: vi.fn(),
    },
    Select: SelectComponent,
    Steps: StepsComponent,
    Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
      <button type='button' aria-pressed={checked} onClick={() => onChange?.(!checked)}>
        switch
      </button>
    ),
    Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

describe('WebuiModalContent', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      value: {
        ...(window.electronAPI ?? {}),
        shellOpenExternal: (...args: unknown[]) => shellOpenExternalMock(...args),
      },
      configurable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    webuiStatusChangedOn.mockImplementation(() => () => undefined);
    webuiResetPasswordResultOn.mockImplementation(() => () => undefined);
    cloudStatusChangedOn.mockImplementation(() => () => undefined);
    webuiGetStatusInvoke.mockResolvedValue({
      success: true,
      data: {
        running: false,
        port: 3000,
        allowRemote: false,
        localUrl: 'http://localhost:3000',
        adminUsername: 'admin',
        localAccessEnabled: false,
        localAccessAllowRemote: false,
      },
    });
    cloudGetStatusInvoke.mockResolvedValue({
      success: true,
      data: {
        authenticated: false,
        browserSessionExpired: false,
        user: null,
        device: null,
        deviceTokenAvailable: false,
        officialRemote: {
          desired: false,
          running: false,
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://auth.contextgo.io',
        apiBaseUrl: 'https://api.contextgo.io',
      },
    });
    cloudEnsureOfficialRemoteReadyInvoke.mockResolvedValue({ success: true, data: null });
    webuiUpdatePreferencesInvoke.mockResolvedValue({ success: true, data: null });
    openExternalInvoke.mockResolvedValue(undefined);
    shellOpenExternalMock.mockResolvedValue(undefined);
    openExternalUrlMock.mockResolvedValue(undefined);
  });

  it('uses the shared settings sub-modal shell for username changes', async () => {
    const { default: WebuiModalContent } =
      await import('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent');

    render(<WebuiModalContent />);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit username' }));

    const modal = await screen.findByTestId('contextgo-modal');
    expect(modal).toHaveClass('settings-sub-modal');
    expect(within(modal).getByText('Set new username')).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('uses the shared settings sub-modal shell for password changes', async () => {
    const { default: WebuiModalContent } =
      await import('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent');

    render(<WebuiModalContent />);

    fireEvent.click(await screen.findByRole('button', { name: 'Set new password' }));

    await waitFor(() => {
      expect(screen.getByTestId('contextgo-modal')).toHaveClass('settings-sub-modal');
    });

    const modal = screen.getByTestId('contextgo-modal');
    expect(within(modal).getByText('Set new password')).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(within(modal).getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('opens Official Remote once desktop relay readiness is available', async () => {
    cloudGetStatusInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-1',
          userId: 'user-1',
          deviceName: 'ContextGo on dev-host',
          platform: 'macos',
          status: 'active',
          createdAt: '2026-04-01T00:00:00Z',
          updatedAt: '2026-04-01T00:00:00Z',
        },
        deviceTokenAvailable: true,
        officialRemoteReady: true,
        officialRemote: {
          desired: true,
          running: true,
          browserEntryReady: true,
          transport: 'cloud-relay',
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://auth.contextgo.io',
        apiBaseUrl: 'https://api.contextgo.io',
      },
    });

    const { default: WebuiModalContent } =
      await import('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent');

    render(<WebuiModalContent />);

    fireEvent.click(await screen.findByRole('button', { name: 'Open Official Remote' }));

    await waitFor(() => {
      expect(openExternalUrlMock).toHaveBeenCalledWith('https://auth.contextgo.io/remote/devices');
    });
    expect(shellOpenExternalMock).not.toHaveBeenCalled();
    expect(openExternalInvoke).not.toHaveBeenCalled();
  });

  it('does not expose local access URL when only official remote runtime is active', async () => {
    webuiGetStatusInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        running: true,
        port: 3000,
        allowRemote: false,
        localUrl: 'http://localhost:3000',
        adminUsername: 'admin',
        localAccessEnabled: false,
        localAccessAllowRemote: false,
      },
    });
    cloudGetStatusInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-1',
          userId: 'user-1',
          deviceName: 'ContextGo on dev-host',
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
          transport: 'cloud-relay',
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://auth.contextgo.io',
        apiBaseUrl: 'https://api.contextgo.io',
      },
    });

    const { default: WebuiModalContent } =
      await import('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent');

    render(<WebuiModalContent />);

    expect(await screen.findByText('Official Remote prepares the desktop runtime automatically. You do not need to enable Local & Self-Hosted Access below.')).toBeInTheDocument();
    expect(screen.queryByText('http://localhost:3000')).not.toBeInTheDocument();
  });

  it('does not show local running status when only official remote runtime is active', async () => {
    webuiGetStatusInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        running: true,
        port: 3000,
        allowRemote: false,
        localUrl: 'http://localhost:3000',
        adminUsername: 'admin',
        localAccessEnabled: false,
        localAccessAllowRemote: false,
      },
    });
    cloudGetStatusInvoke.mockResolvedValueOnce({
      success: true,
      data: {
        authenticated: true,
        browserSessionExpired: false,
        user: {
          id: 'user-1',
          email: 'dev@example.com',
          username: 'dev-user',
          displayName: 'Dev User',
        },
        device: {
          id: 'device-1',
          userId: 'user-1',
          deviceName: 'ContextGo on dev-host',
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
          transport: 'cloud-relay',
        },
        providers: ['github', 'google'],
        authBaseUrl: 'https://auth.contextgo.io',
        apiBaseUrl: 'https://api.contextgo.io',
      },
    });

    const { default: WebuiModalContent } =
      await import('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent');

    render(<WebuiModalContent />);

    await screen.findByText(
      'Official Remote prepares the desktop runtime automatically. You do not need to enable Local & Self-Hosted Access below.'
    );
    expect(screen.queryByText('Running')).not.toBeInTheDocument();
  });
});



