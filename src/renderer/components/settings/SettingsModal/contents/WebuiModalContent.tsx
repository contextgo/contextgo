/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { WEBUI_DEFAULT_PORT } from '@/common/config/constants';
import { cloud, webui, type IWebUIStatus } from '@/common/adapter/ipcBridge';
import type { CloudAuthProviderId, CloudStatus } from '@/common/types/cloud';
import { getPublicDocsUrl, PUBLIC_DOC_SLUGS } from '@/common/update/publicUrls';
import ContextGoScrollArea from '@/renderer/components/base/ContextGoScrollArea';
import { SettingsSubModal } from '@/renderer/components/settings';
import {
  dispatchOfficialRemoteSwitcherEvent,
  getCurrentHostRuntimeDetailStatusKey,
} from '@/renderer/utils/officialRemote';
import { isElectronDesktop, isMacOS, isWindows, openExternalUrl } from '@/renderer/utils/platform';
import { Button, Form, Input, Message, Switch, Tooltip } from '@arco-design/web-react';
import { CheckOne, Copy, Earth, EditTwo, LinkCloud, Refresh } from '@icon-park/react';
import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsViewMode } from '../settingsViewContext';

/**
 * 偏好设置行组件
 * Preference row component
 */
const PreferenceRow: React.FC<{
  label: string;
  description?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, description, extra, children }) => (
  <div className='flex items-center justify-between gap-12px py-12px'>
    <div className='min-w-0 flex-1'>
      <div className='flex items-center gap-8px'>
        <span className='text-14px text-t-primary'>{label}</span>
        {extra}
      </div>
      {description && <div className='text-12px text-t-tertiary mt-2px'>{description}</div>}
    </div>
    <div className='flex items-center shrink-0'>{children}</div>
  </div>
);

const QRCodeSVGLazy = React.lazy(async () => {
  const mod = await import('qrcode.react');
  return { default: mod.QRCodeSVG };
});

const CLOUD_REMOTE_PROVIDERS: CloudAuthProviderId[] = ['github', 'google'];
const formatExpiresAt = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

/**
 * WebUI 设置内容组件
 * WebUI settings content component
 */
const WebuiModalContent: React.FC = () => {
  const { t, i18n } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  const [status, setStatus] = useState<IWebUIStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const port = status?.port ?? WEBUI_DEFAULT_PORT;
  const [cachedIP, setCachedIP] = useState<string | null>(null);
  const [cachedPassword, setCachedPassword] = useState<string | null>(null);
  // 标记密码是否可以明文显示（首次启动且未复制过）/ Flag for plaintext password display (first startup and not copied)
  const [canShowPlainPassword, setCanShowPlainPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  // 设置新密码弹窗 / Set new password modal
  const [setPasswordModalVisible, setSetPasswordModalVisible] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [setUsernameModalVisible, setSetUsernameModalVisible] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [form] = Form.useForm();
  const [usernameForm] = Form.useForm();

  // 二维码登录相关状态 / QR code login related state
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<number | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const qrRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudAuthLoadingProvider, setCloudAuthLoadingProvider] = useState<CloudAuthProviderId | null>(null);
  const supportsDesktopHostSwitcher = isElectronDesktop() && (isMacOS() || isWindows());
  const webuiEnabled = status?.localAccessEnabled ?? false;
  const allowRemotePreference = status?.localAccessAllowRemote ?? false;
  const showLocalBrowserEntrySurface = false;

  // 加载状态 / Load status
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      const result = await Promise.race([webui.getStatus.invoke(), timeoutPromise]);

      if (result && result.success && result.data) {
        setStatus(result.data);
        if (result.data.lanIP) {
          setCachedIP(result.data.lanIP);
        } else if (result.data.networkUrl) {
          const match = result.data.networkUrl.match(/http:\/\/([^:]+):/);
          if (match) {
            setCachedIP(match[1]);
          }
        }
        if (result.data.initialPassword) {
          setCachedPassword(result.data.initialPassword);
          // 有初始密码说明可以显示明文 / Having initial password means can show plaintext
          setCanShowPlainPassword(true);
        }
        // 注意：如果 running 但没有密码，会在下面的 useEffect 中自动重置
        // Note: If running but no password, auto-reset will be triggered in the useEffect below
      } else {
        setStatus(
          (prev) =>
            prev || {
              running: false,
              port: WEBUI_DEFAULT_PORT,
              allowRemote: false,
              localUrl: `http://localhost:${WEBUI_DEFAULT_PORT}`,
              adminUsername: 'admin',
              localAccessEnabled: false,
              localAccessAllowRemote: false,
            }
        );
      }
    } catch (error) {
      console.error('[WebuiModal] Failed to load WebUI status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const refreshCloudStatus = useCallback(async () => {
    setCloudLoading(true);
    try {
      const result = await cloud.getStatus.invoke();
      if (result.success && result.data) {
        setCloudStatus(result.data);
      }
    } catch (error) {
      console.error('[WebuiModal] Failed to load cloud status:', error);
    } finally {
      setCloudLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCloudStatus();

    const unsubscribe = cloud.statusChanged.on((nextStatus) => {
      setCloudStatus(nextStatus);
      setCloudLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshCloudStatus]);

  // 监听状态变更事件 / Listen to status change events
  useEffect(() => {
    const unsubscribe = webui.statusChanged.on((data) => {
      if (data.running) {
        setStatus((prev) => ({
          ...(prev || {
            adminUsername: 'admin',
            localAccessEnabled: false,
            localAccessAllowRemote: false,
          }),
          running: true,
          port: data.port ?? prev?.port ?? WEBUI_DEFAULT_PORT,
          allowRemote: prev?.allowRemote ?? false,
          localUrl: data.localUrl ?? `http://localhost:${data.port ?? WEBUI_DEFAULT_PORT}`,
          networkUrl: data.networkUrl,
          lanIP: prev?.lanIP,
          initialPassword: prev?.initialPassword,
          localAccessEnabled: prev?.localAccessEnabled ?? false,
          localAccessAllowRemote: prev?.localAccessAllowRemote ?? false,
        }));
        if (data.networkUrl) {
          const match = data.networkUrl.match(/http:\/\/([^:]+):/);
          if (match) setCachedIP(match[1]);
        }
      } else {
        setStatus((prev) => (prev ? { ...prev, running: false } : null));
      }
    });
    return () => unsubscribe();
  }, []);

  // 监听密码重置结果事件（Web 环境后备）/ Listen to password reset result events (Web environment fallback)
  useEffect(() => {
    const unsubscribe = webui.resetPasswordResult.on((data) => {
      if (data.success && data.newPassword) {
        setCachedPassword(data.newPassword);
        setStatus((prev) => (prev ? { ...prev, initialPassword: data.newPassword } : null));
        setCanShowPlainPassword(true);
      }
      setResetLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 注意：不再自动重置密码，用户已有密码存储在数据库中
  // Note: No longer auto-reset password, user already has password stored in database
  // 如果用户忘记密码，可以手动点击重置按钮
  // If user forgets password, they can manually click reset button
  useEffect(() => {
    // 仅在组件首次加载且没有显示过密码时，标记为密文状态
    // Only when component first loads and password hasn't been shown, mark as hidden
    if (status?.running && !status?.initialPassword && !cachedPassword && !loading) {
      // 不自动重置，只是确保密码显示为 ******
      // Don't auto-reset, just ensure password shows as ******
      setCanShowPlainPassword(false);
    }
  }, [status?.running, status?.initialPassword, cachedPassword, loading]);

  // 获取当前 IP 地址 / Get current IP
  const getLocalIP = useCallback(() => {
    if (status?.lanIP) return status.lanIP;
    if (cachedIP) return cachedIP;
    if (status?.networkUrl) {
      const match = status.networkUrl.match(/http:\/\/([^:]+):/);
      if (match) return match[1];
    }
    return null;
  }, [status?.lanIP, cachedIP, status?.networkUrl]);

  // 获取显示的 URL / Get display URL
  const getDisplayUrl = useCallback(() => {
    const currentIP = getLocalIP();
    const currentPort = status?.port || port;
    const useRemote = status?.running ? status.allowRemote : allowRemotePreference;
    if (useRemote && currentIP) {
      return `http://${currentIP}:${currentPort}`;
    }
    return `http://localhost:${currentPort}`;
  }, [allowRemotePreference, getLocalIP, status?.allowRemote, status?.port, status?.running, port]);

  // 启动/停止 WebUI / Start/Stop WebUI
  const handleToggle = async (enabled: boolean) => {
    // 使用缓存的 IP，不再阻塞获取 / Use cached IP, no longer block to fetch
    const currentIP = getLocalIP();

    // 保存原始值用于回滚 / Save original value for rollback
    const previousEnabled = webuiEnabled;

    // 立即显示 loading / Immediately show loading
    setStartLoading(true);
    setStatus((prev) => ({
      ...(prev || {
        running: false,
        port,
        allowRemote: false,
        localUrl: `http://localhost:${port}`,
        adminUsername: 'admin',
        localAccessEnabled: false,
        localAccessAllowRemote: allowRemotePreference,
      }),
      localAccessEnabled: enabled,
    }));

    try {
      if (enabled) {
        const localUrl = `http://localhost:${port}`;

        // 减少启动超时到3秒（服务器启动很快）/ Reduce start timeout to 3s (server starts quickly)
        const startResult = await Promise.race([
          webui.start.invoke({ port, allowRemote: allowRemotePreference }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);

        if (startResult && startResult.success && startResult.data) {
          const responseIP = startResult.data.lanIP || currentIP;
          const responsePassword = startResult.data.initialPassword;

          if (responseIP) setCachedIP(responseIP);
          if (responsePassword) {
            setCachedPassword(responsePassword);
            setCanShowPlainPassword(true);
          }

          setStatus((prev) => ({
            ...(prev || {
              adminUsername: 'admin',
              localAccessEnabled: true,
              localAccessAllowRemote: allowRemotePreference,
            }),
            running: true,
            port,
            allowRemote: allowRemotePreference,
            localUrl,
            networkUrl: allowRemotePreference && responseIP ? `http://${responseIP}:${port}` : undefined,
            lanIP: responseIP,
            initialPassword: responsePassword || cachedPassword || prev?.initialPassword,
            localAccessEnabled: true,
            localAccessAllowRemote: allowRemotePreference,
          }));
        } else {
          setStatus((prev) => ({
            ...(prev || {
              adminUsername: 'admin',
              localAccessEnabled: true,
              localAccessAllowRemote: allowRemotePreference,
            }),
            running: true,
            port,
            allowRemote: allowRemotePreference,
            localUrl,
            lanIP: currentIP || prev?.lanIP,
            networkUrl: allowRemotePreference && currentIP ? `http://${currentIP}:${port}` : undefined,
            initialPassword: cachedPassword || prev?.initialPassword,
            localAccessEnabled: true,
            localAccessAllowRemote: allowRemotePreference,
          }));
        }

        Message.success(t('settings.webui.startSuccess'));
      } else {
        // 立即更新UI，异步停止服务器 / Update UI immediately, stop server async
        setStatus((prev) => (prev ? { ...prev, running: false, localAccessEnabled: false } : null));
        Message.success(t('settings.webui.stopSuccess'));
        webui.stop.invoke().catch((err) => console.error('WebUI stop error:', err));
      }
    } catch (error) {
      // 回滚 UI 状态 / Rollback UI state
      setStatus((prev) => (prev ? { ...prev, localAccessEnabled: previousEnabled } : prev));
      console.error('Toggle WebUI error:', error);
      Message.error(t('settings.webui.operationFailed'));
    } finally {
      setStartLoading(false);
    }
  };

  // 处理允许远程访问切换 / Handle allow remote toggle
  // 需要重启服务器才能更改绑定地址 / Need to restart server to change binding address
  const handleAllowRemoteChange = async (checked: boolean) => {
    // 保存原始值用于回滚 / Save original value for rollback
    const previousAllowRemote = allowRemotePreference;
    setStatus((prev) => (prev ? { ...prev, localAccessAllowRemote: checked } : prev));

    const wasRunning = status?.running;

    // 如果服务器正在运行，需要重启以应用新的绑定设置
    // If server is running, need to restart to apply new binding settings
    if (wasRunning) {
      setStartLoading(true);
      try {
        // 1. 先停止服务器 / First stop the server
        try {
          await Promise.race([webui.stop.invoke(), new Promise((resolve) => setTimeout(resolve, 1500))]);
        } catch (err) {
          console.error('WebUI stop error:', err);
        }

        // 2. 立即重新启动（服务器停止很快）/ Restart immediately (server stops quickly)
        const startResult = await Promise.race([
          webui.start.invoke({ port, allowRemote: checked }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);

        if (startResult && startResult.success && startResult.data) {
          const responseIP = startResult.data.lanIP;
          const responsePassword = startResult.data.initialPassword;

          if (responseIP) setCachedIP(responseIP);
          if (responsePassword) setCachedPassword(responsePassword);

          setStatus((prev) => ({
            ...(prev || {
              adminUsername: 'admin',
              localAccessEnabled: true,
              localAccessAllowRemote: checked,
            }),
            running: true,
            port,
            allowRemote: checked,
            localUrl: `http://localhost:${port}`,
            networkUrl: checked && responseIP ? `http://${responseIP}:${port}` : undefined,
            lanIP: responseIP,
            initialPassword: responsePassword || cachedPassword || prev?.initialPassword,
            localAccessEnabled: true,
            localAccessAllowRemote: checked,
          }));

          Message.success(t('settings.webui.restartSuccess'));
        } else {
          // 响应为空或失败，但服务器可能已启动，检查状态
          // Response is null or failed, but server might have started, check status
          const statusResult = await Promise.race([
            webui.getStatus.invoke(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
          ]);

          if (statusResult?.success && statusResult?.data?.running) {
            // 服务器实际上已启动 / Server actually started
            const responseIP = statusResult.data.lanIP;
            if (responseIP) setCachedIP(responseIP);

            setStatus(statusResult.data);
            Message.success(t('settings.webui.restartSuccess'));
          } else {
            // 真的启动失败，回滚 / Really failed to start, rollback
            setStatus((prev) =>
              prev ? { ...prev, running: false, localAccessAllowRemote: previousAllowRemote } : prev
            );
            Message.error(t('settings.webui.operationFailed'));
          }
        }
      } catch (error) {
        // 回滚 UI 状态 / Rollback UI state
        setStatus((prev) => (prev ? { ...prev, localAccessAllowRemote: previousAllowRemote } : prev));
        console.error('[WebuiModal] Restart error:', error);
        Message.error(t('settings.webui.operationFailed'));
      } finally {
        setStartLoading(false);
      }
    } else {
      // 服务器未运行，直接持久化 / Server not running, persist directly
      try {
        const result = await webui.updatePreferences.invoke({ allowRemote: checked, port });
        if (!result.success || !result.data) {
          throw new Error(result.msg || t('settings.webui.operationFailed'));
        }

        if (result.data.lanIP) {
          setCachedIP(result.data.lanIP);
        }
        setStatus(result.data);
      } catch (error) {
        // 回滚 UI 状态 / Rollback UI state
        setStatus((prev) => (prev ? { ...prev, localAccessAllowRemote: previousAllowRemote } : prev));
        console.error('[WebuiModal] Failed to persist allowRemote:', error);
        Message.error(t('settings.webui.operationFailed'));
      }
    }
  };

  // 复制内容 / Copy content
  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    Message.success(t('common.copySuccess'));
  };

  // 打开设置新密码弹窗 / Open set new password modal
  const handleResetPassword = () => {
    form.resetFields();
    setSetPasswordModalVisible(true);
  };

  const handleResetUsername = () => {
    usernameForm.setFieldsValue({
      newUsername: status?.adminUsername || 'admin',
    });
    setSetUsernameModalVisible(true);
  };

  // 提交新密码 / Submit new password
  const handleSetNewPassword = async () => {
    try {
      const values = await form.validate();
      setPasswordLoading(true);

      const result = await webui.changePassword.invoke({
        newPassword: values.newPassword,
      });

      if (result.success) {
        Message.success(t('settings.webui.passwordChanged'));
        setSetPasswordModalVisible(false);
        form.resetFields();
        // 更新缓存的密码为新密码，不再显示明文 / Update cached password, no longer show plaintext
        setCachedPassword(values.newPassword);
        setCanShowPlainPassword(false);
        setStatus((prev) => (prev ? { ...prev, initialPassword: undefined } : null));
      } else {
        Message.error(result.msg || t('settings.webui.passwordChangeFailed'));
      }
    } catch (error) {
      console.error('Set new password error:', error);
      Message.error(t('settings.webui.passwordChangeFailed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSetNewUsername = async () => {
    try {
      const values = await usernameForm.validate();
      setUsernameLoading(true);

      const result = await webui.changeUsername.invoke({
        newUsername: values.newUsername,
      });

      const nextUsername = result.data?.username ?? values.newUsername.trim();
      if (result.success) {
        Message.success(t('settings.webui.usernameChanged'));
        setSetUsernameModalVisible(false);
        usernameForm.resetFields();
        setStatus((prev) => (prev ? { ...prev, adminUsername: nextUsername } : null));
      } else {
        Message.error(result.msg || t('settings.webui.usernameChangeFailed'));
      }
    } catch (error) {
      console.error('Set new username error:', error);
      Message.error(t('settings.webui.usernameChangeFailed'));
    } finally {
      setUsernameLoading(false);
    }
  };

  // 生成二维码 / Generate QR code
  const generateQRCode = useCallback(async () => {
    if (!showLocalBrowserEntrySurface || !status?.running) return;

    setQrLoading(true);
    try {
      const result = await webui.generateQRToken.invoke();

      if (result && result.success && result.data) {
        setQrUrl(result.data.qrUrl);
        setQrExpiresAt(result.data.expiresAt);

        // 设置自动刷新定时器（4分钟后自动刷新，因为 token 5分钟过期）
        // Set auto-refresh timer (refresh after 4 minutes, as token expires in 5 minutes)
        if (qrRefreshTimerRef.current) {
          clearTimeout(qrRefreshTimerRef.current);
        }
        qrRefreshTimerRef.current = setTimeout(
          () => {
            void generateQRCode();
          },
          4 * 60 * 1000
        );
      } else {
        console.error('Generate QR code failed:', result?.msg);
        Message.error(t('settings.webui.qrGenerateFailed'));
      }
    } catch (error) {
      console.error('Generate QR code error:', error);
      Message.error(t('settings.webui.qrGenerateFailed'));
    } finally {
      setQrLoading(false);
    }
  }, [showLocalBrowserEntrySurface, status?.running, t]);

  // 当服务器启动且允许远程访问时自动生成二维码 / Auto-generate QR code when server starts and remote access is allowed
  useEffect(() => {
    if (showLocalBrowserEntrySurface && status?.running && status.allowRemote && !qrUrl) {
      void generateQRCode();
    }
    // 清理定时器 / Cleanup timer
    return () => {
      if (qrRefreshTimerRef.current) {
        clearTimeout(qrRefreshTimerRef.current);
      }
    };
  }, [showLocalBrowserEntrySurface, status?.allowRemote, status?.running, generateQRCode, qrUrl]);

  // 服务器停止或关闭远程访问时清除二维码 / Clear QR code when server stops or remote access is disabled
  useEffect(() => {
    if (!showLocalBrowserEntrySurface || !status?.running || !status.allowRemote) {
      setQrUrl(null);
      setQrExpiresAt(null);
      if (qrRefreshTimerRef.current) {
        clearTimeout(qrRefreshTimerRef.current);
        qrRefreshTimerRef.current = null;
      }
    }
  }, [showLocalBrowserEntrySurface, status?.allowRemote, status?.running]);

  // 获取实际密码 / Get actual password
  const actualPassword = status?.initialPassword || cachedPassword;
  // 获取显示的密码 / Get display password
  // 密码默认显示 ***，只在首次启动时显示明文 / Password shows *** by default, only show plaintext on first startup
  // 重置中显示加载状态 / Show loading state when resetting
  const getDisplayPassword = () => {
    if (resetLoading) return t('common.loading');
    // 可以显示明文且有密码时显示明文 / Show plaintext when allowed and has password
    if (canShowPlainPassword && actualPassword) return actualPassword;
    // 否则显示 ****** / Otherwise show ******
    return t('settings.webui.passwordHidden');
  };
  const displayPassword = getDisplayPassword();
  const displayUsername = status?.adminUsername || 'admin';
  const officialRemoteStatusText = t(getCurrentHostRuntimeDetailStatusKey(cloudStatus));

  const handleCloudLogin = useCallback(
    async (provider: CloudAuthProviderId) => {
      setCloudAuthLoadingProvider(provider);
      try {
        const result = await cloud.startLogin.invoke({ provider });
        if (result.success && result.data) {
          setCloudStatus(result.data);
          Message.success(t('settings.cloud.loginSuccess'));
          return;
        }

        console.error('[WebuiModal] Cloud login failed:', result.msg);
        Message.error(result.msg || t('settings.cloud.actionFailed'));
      } catch (error) {
        console.error('[WebuiModal] Cloud login threw:', error);
        Message.error(error instanceof Error ? error.message : t('settings.cloud.actionFailed'));
      } finally {
        setCloudAuthLoadingProvider(null);
      }
    },
    [t]
  );

  const handleOpenOfficialRemote = useCallback(async () => {
    try {
      dispatchOfficialRemoteSwitcherEvent({ source: 'settings-webui' });
    } catch (error) {
      console.error('[WebuiModal] Failed to open Official Remote switcher:', error);
      Message.error(error instanceof Error ? error.message : t('settings.cloud.actionFailed'));
    }
  }, [t]);

  const webuiPanel = (
    <ContextGoScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
      <div className='space-y-12px px-[12px] md:px-[28px]'>
        {/* 标题 / Title */}
        <h2 className='text-20px font-500 text-t-primary m-0'>{t('settings.webui')}</h2>

        {/* 描述说明 / Description */}
        <div className='space-y-6px'>
          <p className='m-0 text-13px text-t-secondary leading-relaxed'>{t('settings.webui.description')}</p>
          {showLocalBrowserEntrySurface ? (
            <div className='flex flex-wrap gap-x-12px gap-y-6px'>
              {[
                t('settings.webui.enable', { defaultValue: 'Enable WebUI' }),
                t('settings.webui.accessUrl', { defaultValue: 'Access URL' }),
                t('settings.webui.allowRemote', { defaultValue: 'Allow Remote Access' }),
              ].map((stepLabel, idx) => (
                <div key={stepLabel} className='inline-flex items-center gap-6px'>
                  <span className='inline-flex items-center justify-center w-16px h-16px rd-50% text-10px font-600 bg-[rgba(var(--primary-6),0.12)] text-[rgb(var(--primary-6))]'>
                    {idx + 1}
                  </span>
                  <CheckOne theme='outline' size='12' className='text-[rgb(var(--primary-6))]' />
                  <span className='text-12px text-t-secondary'>{stepLabel}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className='px-[12px] md:px-[28px] py-14px bg-2 rd-16px'>
          <div className='flex items-start justify-between gap-12px'>
            <div className='min-w-0'>
              <div className='text-14px font-500 text-t-primary flex items-center gap-8px'>
                <LinkCloud theme='outline' size='16' className='app-icon' />
                <span>{t('settings.webui.officialRemoteTitle')}</span>
              </div>
              <div className='text-12px text-t-secondary mt-4px leading-relaxed'>
                {t('settings.webui.officialRemoteDesc')}
              </div>
            </div>
            <Button type='secondary' size='small' loading={cloudLoading} onClick={() => void refreshCloudStatus()}>
              {t('common.refresh')}
            </Button>
          </div>

          <div className='mt-12px rd-10px border border-line bg-fill-1 px-10px py-8px text-12px text-t-secondary leading-relaxed'>
            {t('settings.webui.officialRemoteLoginRequired')}
          </div>

          <div className='mt-12px'>
            {cloudLoading ? (
              <div className='text-12px text-t-secondary'>{t('settings.cloud.loading')}</div>
            ) : cloudStatus?.user ? (
              <div className='space-y-10px'>
                <div className='text-13px text-t-primary'>
                  {t('settings.webui.officialRemoteSignedIn', {
                    name: cloudStatus.user.displayName || cloudStatus.user.username,
                  })}
                </div>
                <div className='text-12px text-t-tertiary'>{t('settings.webui.officialRemoteRuntimeHint')}</div>
                <div className='text-12px text-t-secondary'>{officialRemoteStatusText}</div>
                {supportsDesktopHostSwitcher ? (
                  <div className='flex flex-wrap gap-8px'>
                    <Button type='primary' onClick={() => void handleOpenOfficialRemote()}>
                      {t('settings.webui.switchDevice')}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className='space-y-10px'>
                <div className='text-13px text-t-primary'>{t('settings.webui.officialRemoteSignedOut')}</div>
                <div className='text-12px text-t-secondary'>{t('settings.webui.officialRemoteHint')}</div>
                <div className='flex flex-wrap gap-8px'>
                  {CLOUD_REMOTE_PROVIDERS.map((provider) => (
                    <Button
                      key={provider}
                      type={provider === 'github' ? 'primary' : 'secondary'}
                      loading={cloudAuthLoadingProvider === provider}
                      disabled={Boolean(cloudAuthLoadingProvider)}
                      onClick={() => void handleCloudLogin(provider)}
                    >
                      {t(provider === 'github' ? 'settings.cloud.loginWithGithub' : 'settings.cloud.loginWithGoogle')}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {showLocalBrowserEntrySurface ? (
          <>
            {/* WebUI 服务卡片 / WebUI Service Card */}
            <div className='px-[12px] md:px-[28px] py-14px bg-2 rd-16px'>
              <div className='text-14px font-500 mb-8px text-t-primary'>{t('settings.webui.localAccessTitle')}</div>

              {/* WebUI 引导提示 / WebUI hint */}
              <div className='mb-8px rd-10px border border-line bg-fill-1 px-10px py-8px flex items-start gap-6px'>
                <Earth theme='outline' size='16' className='mt-1px text-[rgb(var(--primary-6))]' />
                <div className='text-12px text-t-secondary leading-relaxed'>
                  {t('settings.webui.featureRemoteDesc')}
                </div>
              </div>

              {/* 启用 WebUI / Enable WebUI */}
              <PreferenceRow
                label={t('settings.webui.enable')}
                extra={
                  startLoading ? (
                    <span className='text-12px text-warning'>{t('settings.webui.starting')}</span>
                  ) : status?.running && webuiEnabled ? (
                    <span className='text-12px text-success'>✓ {t('settings.webui.running')}</span>
                  ) : null
                }
              >
                <Switch checked={webuiEnabled} loading={startLoading} onChange={handleToggle} />
              </PreferenceRow>

              {/* 访问地址（仅本地/自托管启用且运行时显示）/ Access URL (only when local/self-hosted access is enabled and running) */}
              {status?.running && webuiEnabled && (
                <PreferenceRow label={t('settings.webui.accessUrl')}>
                  <div className='flex items-center gap-8px min-w-0'>
                    <Button
                      type='text'
                      className='!px-0 !min-w-0 !h-auto text-14px text-primary font-mono truncate'
                      onClick={() => void openExternalUrl(getDisplayUrl())}
                    >
                      {getDisplayUrl()}
                    </Button>
                    <Tooltip content={t('common.copy')}>
                      <Button
                        type='text'
                        className='!p-4px text-t-tertiary hover:text-t-primary'
                        onClick={() => handleCopy(getDisplayUrl())}
                      >
                        <Copy size={16} />
                      </Button>
                    </Tooltip>
                  </div>
                </PreferenceRow>
              )}

              {/* 允许局域网访问 / Allow LAN Access */}
              <PreferenceRow
                label={t('settings.webui.allowRemote')}
                description={
                  <span className='text-t-secondary'>
                    {t('settings.webui.allowRemoteDesc')}
                    {'  '}
                    <button
                      className='text-primary hover:underline cursor-pointer bg-transparent border-none p-0 text-12px'
                      onClick={() =>
                        void openExternalUrl(getPublicDocsUrl(i18n.language, PUBLIC_DOC_SLUGS.remoteAccess))
                      }
                    >
                      {t('settings.webui.viewGuide')}
                    </button>
                  </span>
                }
              >
                <Switch checked={allowRemotePreference} onChange={handleAllowRemoteChange} />
              </PreferenceRow>
            </div>

            {/* 登录信息卡片 / Login Info Card */}
            <div className='px-[12px] md:px-[28px] py-14px bg-2 rd-16px'>
              <div className='text-14px font-500 mb-8px text-t-primary'>{t('settings.webui.loginInfo')}</div>

              {/* 账号 / Account */}
              <div className='flex items-center justify-between gap-12px py-12px'>
                <span className='text-14px text-t-secondary shrink-0'>{t('settings.webui.username')}:</span>
                <div className='inline-flex items-center gap-8px rd-100px border border-line bg-fill-1 px-10px py-4px min-w-0'>
                  <span className='text-14px text-t-primary truncate'>{displayUsername}</span>
                  <Tooltip content={t('common.copy')}>
                    <Button
                      type='text'
                      size='mini'
                      className='rd-100px !px-6px inline-flex items-center !h-24px'
                      aria-label={t('common.copy')}
                      onClick={() => handleCopy(displayUsername)}
                    >
                      <Copy size={14} />
                    </Button>
                  </Tooltip>
                  <Tooltip content={t('settings.webui.editUsernameTooltip')}>
                    <Button
                      type='text'
                      size='mini'
                      className='rd-100px !px-6px inline-flex items-center !h-24px'
                      aria-label={t('settings.webui.editUsernameTooltip')}
                      onClick={handleResetUsername}
                    >
                      <EditTwo size={14} />
                    </Button>
                  </Tooltip>
                </div>
              </div>

              {/* 密码 / Password */}
              <div className='flex items-center justify-between gap-12px py-12px'>
                <span className='text-14px text-t-secondary shrink-0'>{t('settings.webui.initialPassword')}:</span>
                <div className='inline-flex items-center gap-8px rd-100px border border-line bg-fill-1 px-10px py-4px min-w-0'>
                  <span className='text-14px text-t-primary truncate'>{displayPassword}</span>
                  <Tooltip content={t('settings.webui.resetPasswordTooltip')}>
                    <Button
                      type='text'
                      size='mini'
                      className='rd-100px !px-6px inline-flex items-center !h-24px'
                      aria-label={t('settings.webui.resetPasswordTooltip')}
                      onClick={handleResetPassword}
                      disabled={resetLoading}
                    >
                      <EditTwo size={14} />
                    </Button>
                  </Tooltip>
                </div>
              </div>

              {/* 二维码登录（仅服务器运行且允许远程访问时显示）/ QR Code Login (only when server running and remote access allowed) */}
              {status?.running && webuiEnabled && status.allowRemote && (
                <>
                  <div className='border-t border-line my-12px' />
                  <div className='text-14px font-500 mb-4px text-t-primary'>{t('settings.webui.qrLogin')}</div>
                  <div className='text-12px text-t-tertiary mb-12px'>{t('settings.webui.qrLoginHint')}</div>

                  <div className='flex flex-col items-center gap-12px'>
                    {/* 二维码显示区域 / QR Code display area */}
                    <div className='p-12px bg-fill-1 border border-line rd-10px'>
                      {qrLoading ? (
                        <div className='w-140px h-140px flex items-center justify-center'>
                          <span className='text-14px text-t-tertiary'>{t('common.loading')}</span>
                        </div>
                      ) : qrUrl ? (
                        <div className='p-8px bg-white rd-8px'>
                          <Suspense
                            fallback={
                              <div className='w-140px h-140px flex items-center justify-center'>
                                <span className='text-14px text-t-tertiary'>{t('common.loading')}</span>
                              </div>
                            }
                          >
                            <QRCodeSVGLazy value={qrUrl} size={140} level='M' />
                          </Suspense>
                        </div>
                      ) : (
                        <div className='w-140px h-140px flex items-center justify-center'>
                          <span className='text-14px text-t-tertiary'>{t('settings.webui.qrGenerateFailed')}</span>
                        </div>
                      )}
                    </div>

                    {/* 过期时间、复制链接和刷新按钮 / Expiration time, copy link and refresh button */}
                    <div className='flex items-center gap-8px'>
                      {qrExpiresAt && (
                        <span className='text-12px text-t-tertiary'>
                          {t('settings.webui.qrExpires', { time: formatExpiresAt(qrExpiresAt) })}
                        </span>
                      )}
                      {qrUrl && (
                        <Tooltip content={t('settings.webui.copyQrLink')}>
                          <button
                            className='p-4px bg-transparent border-none text-t-tertiary hover:text-t-primary cursor-pointer'
                            onClick={() => handleCopy(qrUrl)}
                          >
                            <Copy size={16} />
                          </button>
                        </Tooltip>
                      )}
                      <Tooltip content={t('settings.webui.refreshQr')}>
                        <button
                          className='p-4px bg-transparent border-none text-t-tertiary hover:text-t-primary cursor-pointer'
                          onClick={() => void generateQRCode()}
                          disabled={qrLoading}
                        >
                          <Refresh size={16} className={qrLoading ? 'animate-spin' : ''} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : null}
      </div>
    </ContextGoScrollArea>
  );

  const settingsSubModals = (
    <>
      <SettingsSubModal
        visible={setUsernameModalVisible}
        onCancel={() => setSetUsernameModalVisible(false)}
        style={{ width: 'min(440px, calc(100vw - 32px))' }}
        title={t('settings.webui.setNewUsername')}
        onOk={() => void handleSetNewUsername()}
        confirmLoading={usernameLoading}
      >
        <div className='w-full'>
          <Form form={usernameForm} layout='vertical' className='w-full'>
            <Form.Item
              label={t('settings.webui.newUsername')}
              field='newUsername'
              rules={[
                { required: true, message: t('settings.webui.newUsernameRequired') },
                {
                  validator: (value, callback) => {
                    if (typeof value !== 'string') {
                      callback();
                      return;
                    }

                    const trimmed = value.trim();
                    if (trimmed.length < 3) {
                      callback(t('settings.webui.usernameMinLength'));
                      return;
                    }
                    if (trimmed.length > 32) {
                      callback(t('settings.webui.usernameMaxLength'));
                      return;
                    }
                    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
                      callback(t('settings.webui.usernameFormatError'));
                      return;
                    }
                    if (/^[_-]|[_-]$/.test(trimmed)) {
                      callback(t('settings.webui.usernameEdgeError'));
                      return;
                    }

                    callback();
                  },
                },
              ]}
            >
              <Input placeholder={t('settings.webui.newUsernamePlaceholder')} />
            </Form.Item>
          </Form>
        </div>
      </SettingsSubModal>

      <SettingsSubModal
        visible={setPasswordModalVisible}
        onCancel={() => setSetPasswordModalVisible(false)}
        style={{ width: 'min(440px, calc(100vw - 32px))' }}
        title={t('settings.webui.setNewPassword')}
        onOk={() => void handleSetNewPassword()}
        confirmLoading={passwordLoading}
      >
        <div className='w-full'>
          <Form form={form} layout='vertical' className='w-full'>
            <Form.Item
              label={t('settings.webui.newPassword')}
              field='newPassword'
              rules={[
                { required: true, message: t('settings.webui.newPasswordRequired') },
                {
                  minLength: 8,
                  message: t('settings.webui.passwordMinLength'),
                },
              ]}
            >
              <Input.Password placeholder={t('settings.webui.newPasswordPlaceholder')} />
            </Form.Item>

            <Form.Item
              label={t('settings.webui.confirmPassword')}
              field='confirmPassword'
              rules={[
                { required: true, message: t('settings.webui.confirmPasswordRequired') },
                {
                  validator: (value, callback) => {
                    const nextPassword = form.getFieldValue('newPassword');
                    if (value && nextPassword && value !== nextPassword) {
                      callback(t('settings.webui.passwordMismatch'));
                      return;
                    }
                    callback();
                  },
                },
              ]}
            >
              <Input.Password placeholder={t('settings.webui.confirmPasswordPlaceholder')} />
            </Form.Item>
          </Form>
        </div>
      </SettingsSubModal>
    </>
  );

  return (
    <div className='flex flex-col h-full w-full'>
      {webuiPanel}
      {settingsSubModals}
    </div>
  );
};

export default WebuiModalContent;
