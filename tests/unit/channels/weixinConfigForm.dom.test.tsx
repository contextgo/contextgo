/**
 * DOM tests for WeixinConfigForm login state machine.
 */
/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockEnablePlugin = vi.fn(async () => ({ success: true }));
const mockGetPluginStatus = vi.fn(async () => ({ success: true, data: [] }));
const mockGetPendingPairings = vi.fn(async () => ({ success: true, data: [] }));
const mockGetAuthorizedTargets = vi.fn(async () => ({ success: true, data: [] }));
const mockAuthorizeRemoteUser = vi.fn(async () => ({ success: true }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const mockStartWeixinLogin = vi.fn();
const mockWeixinLoginQrOn = vi.fn(() => vi.fn());
const mockWeixinLoginScannedOn = vi.fn(() => vi.fn());

vi.mock('@/common/adapter/ipcBridge', () => ({
  channel: {
    enablePlugin: { invoke: (...args: unknown[]) => mockEnablePlugin(...args) },
    getPluginStatus: { invoke: (...args: unknown[]) => mockGetPluginStatus(...args) },
    getPendingPairings: { invoke: (...args: unknown[]) => mockGetPendingPairings(...args) },
    getAuthorizedTargets: { invoke: (...args: unknown[]) => mockGetAuthorizedTargets(...args) },
    approvePairing: { invoke: vi.fn(async () => ({ success: true })) },
    authorizeRemoteUser: { invoke: (...args: unknown[]) => mockAuthorizeRemoteUser(...args) },
    startWeixinLogin: { invoke: (...args: unknown[]) => mockStartWeixinLogin(...args) },
    rejectPairing: { invoke: vi.fn(async () => ({ success: true })) },
    revokeUser: { invoke: vi.fn(async () => ({ success: true })) },
    disablePlugin: { invoke: vi.fn(async () => ({ success: true })) },
    pairingRequested: { on: vi.fn(() => vi.fn()) },
    userAuthorized: { on: vi.fn(() => vi.fn()) },
    weixinLoginQr: { on: (...args: unknown[]) => mockWeixinLoginQrOn(...args) },
    weixinLoginScanned: { on: (...args: unknown[]) => mockWeixinLoginScannedOn(...args) },
  },
}));

vi.mock('@arco-design/web-react', async () => {
  return {
    Alert: ({ content }: { content?: React.ReactNode }) => <div>{content}</div>,
    Button: ({
      children,
      onClick,
      loading,
      icon,
      type,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      loading?: boolean;
      icon?: React.ReactNode;
      type?: string;
    }) => (
      <button type='button' data-loading={loading ? 'true' : 'false'} data-kind={type} onClick={onClick}>
        {icon}
        {children}
      </button>
    ),
    Empty: ({ description }: { description?: React.ReactNode }) => <div>{description}</div>,
    Message: {
      error: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
    Spin: ({ size }: { size?: number }) => <div data-testid='spin'>{size ?? 'default'}</div>,
    Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('@icon-park/react', () => ({
  CheckOne: () => <span>check</span>,
  CloseOne: () => <span>close</span>,
  Copy: () => <span>copy</span>,
  Delete: () => <span>delete</span>,
  Refresh: () => <span>refresh</span>,
}));

import WeixinConfigForm from '@/renderer/components/settings/SettingsModal/contents/channels/configForms/WeixinConfigForm';

describe('WeixinConfigForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWeixinLoginQrOn.mockReturnValue(vi.fn());
    mockWeixinLoginScannedOn.mockReturnValue(vi.fn());
    mockGetPendingPairings.mockResolvedValue({ success: true, data: [] });
    mockGetAuthorizedTargets.mockResolvedValue({ success: true, data: [] });
    mockGetPluginStatus.mockResolvedValue({ success: true, data: [] });
    mockEnablePlugin.mockResolvedValue({ success: true });
    mockAuthorizeRemoteUser.mockResolvedValue({ success: true });
  });

  it('resets to login state when switching to another wechat instance without token', async () => {
    mockGetAuthorizedTargets.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'target-1',
          connectorId: 'weixin_primary',
          platformType: 'weixin',
          targetId: 'wx-user-1',
          displayName: 'wx user',
          authorizedAt: 1000,
        },
      ],
    });

    const { rerender } = render(
      <WeixinConfigForm
        pluginId='weixin_primary'
        pluginStatus={{
          id: 'weixin_primary',
          type: 'weixin',
          enabled: true,
          connected: true,
          hasToken: true,
          name: 'WeChat 1',
          status: 'running',
          activeUsers: 0,
        }}
        onStatusChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('已完成授权，可直接使用')).toBeInTheDocument();
    });

    rerender(<WeixinConfigForm pluginId='weixin_secondary' pluginStatus={null} onStatusChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '扫码登录并完成授权' })).toBeInTheDocument();
    });
    expect(screen.queryByText('已完成授权，可直接使用')).toBeNull();
  });

  it('renders login button in idle state', () => {
    render(<WeixinConfigForm pluginId='weixin_default' pluginStatus={null} onStatusChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '扫码登录并完成授权' })).toBeInTheDocument();
    expect(
      screen.getByText('当前微信接入是个人账号桥接，不等价于 Slack、Discord、Lark 这类官方 Bot 平台。')
    ).toBeInTheDocument();
  });

  it('shows loading state when login starts', async () => {
    mockStartWeixinLogin.mockReturnValue(new Promise(() => {}));

    render(<WeixinConfigForm pluginId='weixin_default' pluginStatus={null} onStatusChange={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '扫码登录并完成授权' }));
    });

    expect(screen.getByRole('button', { name: '扫码登录并完成授权' })).toHaveAttribute('data-loading', 'true');
  });

  it('displays QR image and centered panel when qrcodeUrl is set', async () => {
    let qrCallback: ((data: { qrcodeUrl: string }) => void) | null = null;
    mockWeixinLoginQrOn.mockImplementation((cb: (data: { qrcodeUrl: string }) => void) => {
      qrCallback = cb;
      return vi.fn();
    });
    mockStartWeixinLogin.mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <WeixinConfigForm pluginId='weixin_default' pluginStatus={null} onStatusChange={vi.fn()} />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '扫码登录并完成授权' }));
    });

    await act(async () => {
      qrCallback?.({ qrcodeUrl: 'https://example.com/qr.png' });
    });

    const img = screen.getByRole('img', { name: 'WeChat QR code' });
    expect((img as HTMLImageElement).src).toContain('qr.png');
    expect(screen.getByText('请用微信扫描二维码')).toBeInTheDocument();
    expect(container.querySelector('[class*="qrPanel"]')).not.toBeNull();
  });

  it('shows scanned text when onScanned fires', async () => {
    let qrCallback: ((data: { qrcodeUrl: string }) => void) | null = null;
    let scannedCallback: (() => void) | null = null;

    mockWeixinLoginQrOn.mockImplementation((cb: (data: { qrcodeUrl: string }) => void) => {
      qrCallback = cb;
      return vi.fn();
    });
    mockWeixinLoginScannedOn.mockImplementation((cb: () => void) => {
      scannedCallback = cb;
      return vi.fn();
    });
    mockStartWeixinLogin.mockReturnValue(new Promise(() => {}));

    render(<WeixinConfigForm pluginId='weixin_default' pluginStatus={null} onStatusChange={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '扫码登录并完成授权' }));
    });
    await act(async () => {
      qrCallback?.({ qrcodeUrl: 'https://example.com/qr.png' });
    });
    await act(async () => {
      scannedCallback?.();
    });

    expect(screen.getByText('已扫码，等待确认并完成授权...')).toBeInTheDocument();
  });

  it('auto-authorizes the scanned wechat user after login succeeds', async () => {
    mockStartWeixinLogin.mockResolvedValue({
      success: true,
      data: {
        accountId: 'wx-bot-1',
        botToken: 'token-1',
        scannerUserId: 'wx-user-1',
      },
    });

    render(<WeixinConfigForm pluginId='weixin_default' pluginStatus={null} onStatusChange={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '扫码登录并完成授权' }));
    });

    expect(mockEnablePlugin).toHaveBeenCalledWith({
      pluginId: 'weixin_default',
      config: { accountId: 'wx-bot-1', botToken: 'token-1' },
    });
    expect(mockAuthorizeRemoteUser).toHaveBeenCalledWith({
      platformUserId: 'wx-user-1',
      platformType: 'weixin',
      displayName: '当前扫码微信',
      chatId: 'wx-user-1',
      pluginId: 'weixin_default',
      metadata: {
        source: 'weixin-qr-login',
        loginAccountId: 'wx-bot-1',
      },
    });
  });

  it('rolls back enablement when the scanned wechat user is missing', async () => {
    mockStartWeixinLogin.mockResolvedValue({
      success: true,
      data: {
        accountId: 'wx-bot-1',
        botToken: 'token-1',
      },
    });

    render(<WeixinConfigForm pluginId='weixin_default' pluginStatus={null} onStatusChange={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '扫码登录并完成授权' }));
    });

    const disablePlugin = vi.mocked((await import('@/common/adapter/ipcBridge')).channel.disablePlugin.invoke);
    await waitFor(() => {
      expect(disablePlugin).toHaveBeenCalledWith({ pluginId: 'weixin_default' });
    });
    expect(mockAuthorizeRemoteUser).not.toHaveBeenCalled();
  });

  it('shows signed-in state instead of ready state when token exists without authorized targets', () => {
    render(
      <WeixinConfigForm
        pluginId='weixin_default'
        pluginStatus={{
          id: 'weixin_default',
          type: 'weixin',
          enabled: true,
          connected: true,
          hasToken: true,
          name: 'WeChat',
          status: 'running',
          activeUsers: 0,
        }}
        onStatusChange={vi.fn()}
      />
    );

    expect(screen.getByText('微信渠道已连接')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();
    expect(screen.queryByText('已完成授权，可直接使用')).toBeNull();
    expect(screen.queryByRole('button', { name: '扫码登录并完成授权' })).toBeNull();
  });

  it('shows ready state only after authorized targets exist', async () => {
    mockGetAuthorizedTargets.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'target-1',
          connectorId: 'weixin_default',
          platformType: 'weixin',
          targetId: 'wx-user-1',
          displayName: 'wx user',
          authorizedAt: 1000,
        },
      ],
    });

    render(
      <WeixinConfigForm
        pluginId='weixin_default'
        pluginStatus={{
          id: 'weixin_default',
          type: 'weixin',
          enabled: true,
          connected: true,
          hasToken: true,
          name: 'WeChat',
          status: 'running',
          activeUsers: 0,
        }}
        onStatusChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('已完成授权，可直接使用')).toBeInTheDocument();
    });
    expect(screen.queryByText('微信渠道已连接')).toBeNull();
    expect(screen.queryByText('Next Steps')).toBeNull();
  });
});
