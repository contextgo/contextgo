import { ipcBridge } from '@/common';
import type {
  CloudAuthProviderId,
  CloudRemoteDevice,
  CloudRemoteDevicesPayload,
  CloudStatus,
} from '@/common/types/cloud';
import type { SpaceProviderRef, SpaceVaultProviderRef } from '@/common/config/storage';
import { useThemeContext } from '@/renderer/hooks/context/ThemeContext';
import { changeLanguage } from '@/renderer/services/i18n';
import type { Theme } from '@/renderer/hooks/system/useTheme';
import {
  Computer,
  ConnectionPoint,
  Down,
  Earth,
  LinkCloud,
  FolderOpen,
  Moon,
  Plus,
  Right,
  Robot,
  RobotOne,
  SettingTwo,
  Sun,
  Theme as ThemeIcon,
} from '@icon-park/react';
import { Button, Dropdown, Input, Menu, Message } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { iconColors } from '@renderer/styles/colors';
import InfermeshMenuLogo from '@renderer/assets/logos/brand/infermesh-menu.png';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { cleanupSiderTooltips } from '@renderer/utils/ui/siderTooltip';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useRemoteAccessContext } from '@renderer/hooks/context/RemoteAccessContext';
import { blurActiveElement } from '@renderer/utils/ui/focus';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { useSelectedSpace } from '@renderer/hooks/context/useSelectedSpace';
import ConversationSearchPopover from '@renderer/pages/conversation/GroupedHistory/ConversationSearchPopover';
import { useConversationAgents } from '@renderer/pages/conversation/hooks/useConversationAgents';
import { useConversationTabs } from '@renderer/pages/conversation/hooks/ConversationTabsContext';
import CreateGroupModal from '@renderer/pages/conversation/platforms/group/CreateGroupModal';
import { emitter } from '@renderer/utils/emitter';
import { isElectronDesktop, isMacOS, isMobileShellWebView, openExternalUrl } from '@renderer/utils/platform';
import { buildOfficialRemoteDevicesRoute, OFFICIAL_REMOTE_SWITCHER_EVENT } from '@renderer/utils/officialRemote';
import { preloadRoutePath } from './routerLocation';
import { ContextGoModal } from '../base';

const WorkspaceGroupedHistory = React.lazy(() => import('@renderer/pages/conversation/GroupedHistory'));
const SettingsSider = React.lazy(() => import('@renderer/pages/settings/components/SettingsSider'));

interface SiderProps {
  onSessionClick?: () => void;
  collapsed?: boolean;
}

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
  { value: 'tr-TR', label: 'Türkçe' },
  { value: 'en-US', label: 'English' },
] as const;

const DEVICE_SWITCHER_REQUEST_TIMEOUT_MS = 6_000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(label + ' timed out after ' + timeoutMs + 'ms'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const renderUserMenuLabel = (icon: React.ReactNode, label: string, value?: React.ReactNode) => (
  <div className='sider-user-menu__row'>
    <span className='sider-user-menu__icon'>{icon}</span>
    <span className='sider-user-menu__row-text'>{label}</span>
    {value ? <span className='sider-user-menu__row-value'>{value}</span> : null}
  </div>
);

const isObsidianVaultProviderRef = (providerRef?: SpaceProviderRef): providerRef is SpaceVaultProviderRef => {
  return providerRef != null && 'kind' in providerRef && providerRef.kind === 'obsidian-vault';
};

const buildObsidianVaultUri = (providerRef: SpaceVaultProviderRef): string => {
  const encodedVaultName = encodeURIComponent(providerRef.vaultName);
  const encodedFile = providerRef.landingNotePath ? `&file=${encodeURIComponent(providerRef.landingNotePath)}` : '';
  return `obsidian://open?vault=${encodedVaultName}${encodedFile}`;
};

const isOpenableRemoteDevice = (device: CloudRemoteDevice): boolean => {
  return (
    device.status === 'active' &&
    device.remoteStatus.connected === true &&
    device.remoteStatus.browserEntryReady === true
  );
};

const isCurrentCloudDeviceReady = (cloudStatus: CloudStatus | null): boolean => {
  return Boolean(
    cloudStatus?.authenticated &&
    (cloudStatus.officialRemoteReady === true ||
      (cloudStatus.officialRemote.running === true && cloudStatus.officialRemote.browserEntryReady === true))
  );
};

const shouldEnsureCurrentCloudDevice = (cloudStatus: CloudStatus | null): boolean => {
  if (!cloudStatus?.authenticated || !cloudStatus.device || !cloudStatus.deviceTokenAvailable) {
    return false;
  }

  if (cloudStatus.officialRemote?.needsAttention === true) {
    return false;
  }

  return !isCurrentCloudDeviceReady(cloudStatus);
};

const getRemoteDeviceStatusKey = (
  device: CloudRemoteDevice,
  cloudStatus: CloudStatus | null,
  isCurrentDevice = false
): string => {
  if (!cloudStatus?.authenticated) {
    return 'settings.webui.officialRemoteStatusShort.signedOut';
  }

  if (isCurrentDevice) {
    if (isCurrentCloudDeviceReady(cloudStatus)) {
      return 'settings.webui.officialRemoteStatusShort.ready';
    }

    if (cloudStatus.officialRemote?.needsAttention) {
      return 'settings.webui.officialRemoteStatusShort.relogin';
    }

    if (!cloudStatus.deviceTokenAvailable) {
      return 'settings.webui.officialRemoteStatusShort.linking';
    }

    if (cloudStatus.officialRemote?.running) {
      return 'settings.webui.officialRemoteStatusShort.preparing';
    }

    if (cloudStatus.officialRemote?.desired) {
      return 'settings.webui.officialRemoteStatusShort.connecting';
    }

    return 'settings.webui.officialRemoteStatusShort.unavailable';
  }

  if (device.remoteStatus.clientConnected || isOpenableRemoteDevice(device)) {
    return 'settings.webui.officialRemoteStatusShort.ready';
  }

  if (device.remoteStatus.connected) {
    return 'settings.webui.officialRemoteStatusShort.preparing';
  }

  return 'settings.webui.officialRemoteStatusShort.unavailable';
};

const formatRemoteDeviceLastSeen = (value: string | null | undefined, language: string): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat(language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const buildCurrentDeviceFallback = (
  cloudStatus: CloudStatus | null,
  remoteDevices: CloudRemoteDevice[]
): CloudRemoteDevice | null => {
  if (!cloudStatus?.device) {
    return null;
  }

  if (remoteDevices.some((device) => device.id === cloudStatus.device?.id)) {
    return null;
  }

  return {
    ...cloudStatus.device,
    remoteStatus: {
      connected: cloudStatus.officialRemote.running === true,
      clientConnected: cloudStatus.officialRemote.clientConnected === true,
      transport: cloudStatus.officialRemote.transport,
      browserEntryReady: cloudStatus.officialRemote.browserEntryReady === true,
      browserEntryReason: cloudStatus.officialRemote.browserEntryReason,
      browserEntryUrl: null,
      connectedAt: null,
      clientConnectedAt: null,
    },
  };
};

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const location = useLocation();
  const { pathname } = location;

  const { t, i18n } = useTranslation();
  const remoteAccess = useRemoteAccessContext();
  const { theme, setTheme } = useThemeContext();
  const navigate = useNavigate();
  const { closePreview } = usePreviewContext();
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [spaceModalVisible, setSpaceModalVisible] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [desktopUsername, setDesktopUsername] = useState('');
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [openingSpaceVault, setOpeningSpaceVault] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [authLoadingProvider, setAuthLoadingProvider] = useState<CloudAuthProviderId | null>(null);
  const [cloudActionLoading, setCloudActionLoading] = useState<'infermesh' | 'logout' | null>(null);
  const [cloudLoginVisible, setCloudLoginVisible] = useState(false);
  const [deviceSwitchVisible, setDeviceSwitchVisible] = useState(false);
  const [remoteDevicesPayload, setRemoteDevicesPayload] = useState<CloudRemoteDevicesPayload | null>(null);
  const [remoteDevicesLoading, setRemoteDevicesLoading] = useState(false);
  const [remoteDevicesError, setRemoteDevicesError] = useState<string | null>(null);
  const [openingRemoteDeviceId, setOpeningRemoteDeviceId] = useState<string | null>(null);
  const isSettings = pathname.startsWith('/settings');
  const isConversationRoute = pathname.startsWith('/conversation/');
  const isDesktopRuntime = isElectronDesktop();

  const showDesktopChromeOverlayInset = !isMobile && !isConversationRoute && (!isDesktopRuntime || isMacOS());
  const { cliAgents, presetAssistants } = useConversationAgents();
  const { activeTab, openTab } = useConversationTabs();
  const { user } = useAuth();
  const {
    spaces,
    selectedSpace,
    isLoading: spacesLoading,
    isCreating: creatingSpace,
    selectSpace,
    createSpace,
  } = useSelectedSpace();

  const refreshCloudStatus = async (): Promise<CloudStatus | null> => {
    setCloudLoading(true);
    try {
      const result = await withTimeout(
        ipcBridge.cloud.getStatus.invoke(),
        DEVICE_SWITCHER_REQUEST_TIMEOUT_MS,
        'Cloud status'
      );
      if (result.success && result.data) {
        setCloudStatus(result.data);
        if (!result.data.authenticated) {
          setRemoteDevicesPayload(null);
        }
        return result.data;
      }
    } catch (error) {
      console.error('[Sider] Failed to load cloud status:', error);
    } finally {
      setCloudLoading(false);
    }

    return null;
  };

  const handleNavigate = (target: string) => {
    preloadRoutePath(target);
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate(target)).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };

  const handlePreloadRoute = (target: string) => {
    preloadRoutePath(target);
  };

  const handleConversationSelect = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
  };
  const handleCreateConversation = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    Promise.resolve(navigate('/guid')).catch((error) => {
      console.error('Navigation failed:', error);
    });
    if (onSessionClick) {
      onSessionClick();
    }
  };
  const handleCreateGroup = () => {
    cleanupSiderTooltips();
    blurActiveElement();
    closePreview();
    setIsBatchMode(false);
    setGroupModalVisible(true);
  };

  const handleOpenSettings = () => {
    setUserMenuVisible(false);
    handleNavigate('/settings/system');
  };

  const handleOpenCloudLogin = () => {
    setUserMenuVisible(false);
    setCloudLoginVisible(true);
  };

  const handleCloseCloudLogin = () => {
    if (authLoadingProvider) {
      return;
    }

    setCloudLoginVisible(false);
  };

  const handleOpenSpaceVault = async () => {
    if (openingSpaceVault) {
      return;
    }

    setOpeningSpaceVault(true);
    try {
      const targetSpace = selectedSpace ?? (await ipcBridge.space.ensureDefault.invoke());
      if (!selectedSpace?.id) {
        await selectSpace(targetSpace.id);
      }

      if (isMobileShellWebView() && isObsidianVaultProviderRef(targetSpace.providerRef)) {
        await openExternalUrl(buildObsidianVaultUri(targetSpace.providerRef));
        return;
      }

      const result = await ipcBridge.space.openVault.invoke({ id: targetSpace.id });
      if (!result.obsidianInstalled) {
        await openExternalUrl('https://obsidian.md/download');
        Message.warning(t('guid.vault.obsidianMissing'));
        return;
      }
      Message.success(t('guid.vault.openSuccess'));
    } catch (error) {
      console.error('[Sider] Failed to open space vault:', error);
      Message.error(error instanceof Error ? error.message : t('guid.vault.openFailed'));
    } finally {
      setOpeningSpaceVault(false);
    }
  };

  const handleSwitchSpace = async (spaceId: string) => {
    const nextSpace = spaces.find((space) => space.id === spaceId);
    if (!nextSpace) {
      return;
    }

    try {
      await selectSpace(spaceId);
      Message.success(
        t('guid.space.switchSuccess', {
          name: nextSpace.name,
        })
      );
    } catch (error) {
      console.error('[Sider] Failed to switch space:', error);
      Message.error(error instanceof Error ? error.message : t('guid.space.switchFailed'));
    }
  };

  const handleOpenCreateSpaceModal = () => {
    setSpaceModalVisible(true);
  };

  const handleCloseCreateSpaceModal = () => {
    if (creatingSpace) {
      return;
    }

    setSpaceModalVisible(false);
    setNewSpaceName('');
    setNewSpaceDescription('');
  };

  const handleCreateSpace = async () => {
    const trimmedName = newSpaceName.trim();
    const trimmedDescription = newSpaceDescription.trim();

    if (!trimmedName) {
      Message.warning(t('guid.space.nameRequired'));
      return;
    }

    try {
      const createdSpace = await createSpace({
        name: trimmedName,
        description: trimmedDescription || undefined,
      });
      Message.success(
        t('guid.space.createSuccess', {
          name: createdSpace.name,
        })
      );
      handleCloseCreateSpaceModal();
    } catch (error) {
      console.error('[Sider] Failed to create space:', error);
      Message.error(error instanceof Error ? error.message : t('guid.space.createFailed'));
    }
  };

  const handleToggleDevTools = () => {
    ipcBridge.application.openDevTools
      .invoke()
      .then((isOpen) => {
        setIsDevToolsOpen(Boolean(isOpen));
        setUserMenuVisible(false);
      })
      .catch((error: Error) => {
        console.error('Failed to toggle dev tools:', error);
      });
  };

  const handleChangeLanguage = (language: (typeof LANGUAGE_OPTIONS)[number]['value']) => {
    changeLanguage(language).catch((error: Error) => {
      console.error('Failed to change language:', error);
    });
    setUserMenuVisible(false);
  };

  useEffect(() => {
    if (user?.username) {
      setDesktopUsername(user.username);
      return;
    }
    if (typeof window === 'undefined' || !window.electronAPI) {
      setDesktopUsername('');
      return;
    }

    let cancelled = false;
    ipcBridge.application.getPath
      .invoke({ name: 'home' })
      .then((homePath) => {
        if (cancelled) {
          return;
        }
        setDesktopUsername(homePath.split(/[\\/]/).findLast((segment) => segment.length > 0) ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setDesktopUsername('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.username]);

  useEffect(() => {
    ipcBridge.application.isDevToolsOpened
      .invoke()
      .then((isOpen) => setIsDevToolsOpen(Boolean(isOpen)))
      .catch((error: Error) => {
        console.error('Failed to get dev tools state:', error);
      });

    const unsubscribe = ipcBridge.application.devToolsStateChanged.on((event) => {
      setIsDevToolsOpen(event.isOpen);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setUserMenuVisible(false);
  }, [pathname]);

  useEffect(() => {
    void refreshCloudStatus();

    const unsubscribe = ipcBridge.cloud.statusChanged.on((nextStatus) => {
      setCloudStatus(nextStatus);
      if (!nextStatus.authenticated) {
        setRemoteDevicesPayload(null);
      }
      setCloudLoading(false);
      setAuthLoadingProvider(null);
      setCloudActionLoading(null);
    });

    return () => {
      unsubscribe();
    };
  }, []);
  const handleCloudLogin = async (provider: CloudAuthProviderId) => {
    setAuthLoadingProvider(provider);
    try {
      const result = await ipcBridge.cloud.startLogin.invoke({ provider });
      if (result.success && result.data) {
        setCloudStatus(result.data);
        if (deviceSwitchVisible && result.data.authenticated) {
          void loadRemoteDevices();
        }
        Message.success(t('settings.cloud.loginSuccess'));
        return;
      }

      const reconciledStatus = await refreshCloudStatus();
      if (reconciledStatus?.user) {
        if (deviceSwitchVisible) {
          void loadRemoteDevices();
        }
        Message.success(t('settings.cloud.loginSuccess'));
        return;
      }

      Message.error(result.msg || t('settings.cloud.actionFailed'));
    } catch (error) {
      console.error('[Sider] Cloud login failed:', error);
      const reconciledStatus = await refreshCloudStatus();
      if (reconciledStatus?.user) {
        if (deviceSwitchVisible) {
          void loadRemoteDevices();
        }
        Message.success(t('settings.cloud.loginSuccess'));
        return;
      }

      Message.error(error instanceof Error ? error.message : t('settings.cloud.actionFailed'));
    } finally {
      setAuthLoadingProvider(null);
    }
  };

  const handleCloudLogout = async () => {
    setCloudActionLoading('logout');
    try {
      const result = await ipcBridge.cloud.logout.invoke();
      if (result.success && result.data) {
        setCloudStatus(result.data);
        setRemoteDevicesPayload(null);
        Message.success(t('settings.cloud.logoutSuccess'));
        return;
      }

      Message.error(result.msg || t('settings.cloud.actionFailed'));
    } catch (error) {
      console.error('[Sider] Cloud logout failed:', error);
      Message.error(error instanceof Error ? error.message : t('settings.cloud.actionFailed'));
    } finally {
      setCloudActionLoading(null);
    }
  };

  const handleOpenInfermesh = async () => {
    setCloudActionLoading('infermesh');
    try {
      const result = await ipcBridge.cloud.openInfermesh.invoke();
      if (result.success && result.data) {
        setCloudStatus(result.data);
        return;
      }

      Message.error(result.msg || t('settings.cloud.actionFailed'));
    } catch (error) {
      console.error('[Sider] Failed to open InferMesh:', error);
      Message.error(error instanceof Error ? error.message : t('settings.cloud.actionFailed'));
    } finally {
      setCloudActionLoading(null);
    }
  };

  const loadRemoteDevices = async (options?: {
    preserveLoadingState?: boolean;
  }): Promise<CloudRemoteDevicesPayload | null> => {
    if (!options?.preserveLoadingState) {
      setRemoteDevicesLoading(true);
    }
    setRemoteDevicesError(null);
    try {
      const result = await withTimeout(
        ipcBridge.cloud.listRemoteDevices.invoke(),
        DEVICE_SWITCHER_REQUEST_TIMEOUT_MS,
        'Remote device list'
      );
      if (result.success && result.data) {
        setRemoteDevicesPayload(result.data);
        return result.data;
      }

      setRemoteDevicesError(result.msg || t('settings.cloud.actionFailed'));
    } catch (error) {
      console.error('[Sider] Failed to load remote devices:', error);
      setRemoteDevicesError(error instanceof Error ? error.message : t('settings.cloud.actionFailed'));
    } finally {
      if (!options?.preserveLoadingState) {
        setRemoteDevicesLoading(false);
      }
    }

    return null;
  };

  const reconcileCurrentDeviceForSwitcher = async (status: CloudStatus | null): Promise<void> => {
    if (!status?.authenticated || !shouldEnsureCurrentCloudDevice(status)) {
      return;
    }

    try {
      const ensured = await withTimeout(
        ipcBridge.cloud.ensureOfficialRemoteReady.invoke(),
        DEVICE_SWITCHER_REQUEST_TIMEOUT_MS,
        'Official Remote readiness'
      );
      if (ensured.success && ensured.data) {
        setCloudStatus(ensured.data);
        return;
      }

      if (ensured.msg) {
        console.error('[Sider] Failed to ensure Official Remote readiness:', ensured.msg);
      }
    } catch (error) {
      console.error('[Sider] Failed to ensure Official Remote readiness:', error);
    }
  };

  const prepareRemoteDevicesForSwitcher = async (status: CloudStatus | null): Promise<void> => {
    if (!status?.authenticated) {
      return;
    }

    setRemoteDevicesError(null);
    const ensurePromise = reconcileCurrentDeviceForSwitcher(status);
    await loadRemoteDevices();
    void ensurePromise;
  };

  const handleOpenDeviceSwitcher = () => {
    setUserMenuVisible(false);
    setDeviceSwitchVisible(true);
    setRemoteDevicesError(null);

    if (cloudStatus?.authenticated) {
      void prepareRemoteDevicesForSwitcher(cloudStatus);
      return;
    }

    setRemoteDevicesPayload(null);
    void refreshCloudStatus().then((status) => {
      if (status?.authenticated) {
        void prepareRemoteDevicesForSwitcher(status);
      }
    });
  };

  const handleCloseDeviceSwitcher = () => {
    if (openingRemoteDeviceId) {
      return;
    }

    setDeviceSwitchVisible(false);
    setRemoteDevicesError(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleOpenOfficialRemoteSwitcher = () => {
      handleOpenDeviceSwitcher();
    };

    window.addEventListener(OFFICIAL_REMOTE_SWITCHER_EVENT, handleOpenOfficialRemoteSwitcher);
    return () => {
      window.removeEventListener(OFFICIAL_REMOTE_SWITCHER_EVENT, handleOpenOfficialRemoteSwitcher);
    };
  }, [cloudStatus?.authenticated]);

  const handleOpenRemoteDevice = (deviceId: string) => {
    const normalizedDeviceId = deviceId.trim();
    if (!normalizedDeviceId) {
      return;
    }

    setOpeningRemoteDeviceId(normalizedDeviceId);
    setDeviceSwitchVisible(false);
    handleNavigate(buildOfficialRemoteDevicesRoute({ preferredDeviceId: normalizedDeviceId }));
    setOpeningRemoteDeviceId(null);
  };

  const workspaceHistoryProps = {
    collapsed,
    tooltipEnabled: collapsed && !isMobile,
    onSessionClick,
    batchMode: isBatchMode,
    onBatchModeChange: setIsBatchMode,
  };
  const tooltipEnabled = collapsed && !isMobile;
  const activeWorkspace = activeTab?.workspace || '';
  const actionRowClassName = classNames(
    'sider-entry-row flex w-full min-w-0 items-center gap-10px rounded-10px px-12px py-9px text-left transition-colors',
    isMobile && 'sider-action-btn-mobile'
  );
  const currentLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === i18n.language)?.label ||
    LANGUAGE_OPTIONS.find((option) => option.value === 'en-US')?.label ||
    'English';
  const themeOptions: Array<{ value: Theme; label: string }> = [
    { value: 'light', label: t('settings.lightMode') },
    { value: 'dark', label: t('settings.darkMode') },
  ];
  const currentThemeLabel = themeOptions.find((option) => option.value === theme)?.label || t('settings.theme');
  const userDisplayName = user?.displayName || user?.username || desktopUsername || t('common.localUser');
  const currentDeviceName = cloudStatus?.device?.deviceName || t('settings.webui.switchDeviceUnknown');
  const remoteDevices = remoteDevicesPayload?.devices ?? [];
  const currentDeviceFallback = useMemo(
    () => buildCurrentDeviceFallback(cloudStatus, remoteDevices),
    [cloudStatus, remoteDevices]
  );
  const switcherDevices = useMemo(
    () => (currentDeviceFallback ? [...remoteDevices, currentDeviceFallback] : remoteDevices),
    [currentDeviceFallback, remoteDevices]
  );
  const preferredRemoteDeviceId = remoteDevicesPayload?.selection.preferredDeviceId ?? null;
  const currentCloudDeviceId = cloudStatus?.device?.id ?? null;
  const orderedRemoteDevices = useMemo(() => {
    return [...switcherDevices].sort((left, right) => {
      const leftIsCurrent = currentCloudDeviceId === left.id;
      const rightIsCurrent = currentCloudDeviceId === right.id;
      if (leftIsCurrent !== rightIsCurrent) {
        return leftIsCurrent ? 1 : -1;
      }

      const leftIsOpenable = isOpenableRemoteDevice(left);
      const rightIsOpenable = isOpenableRemoteDevice(right);
      if (leftIsOpenable !== rightIsOpenable) {
        return leftIsOpenable ? -1 : 1;
      }

      const leftLastSeen = left.lastSeenAt ? Date.parse(left.lastSeenAt) : 0;
      const rightLastSeen = right.lastSeenAt ? Date.parse(right.lastSeenAt) : 0;
      return rightLastSeen - leftLastSeen;
    });
  }, [currentCloudDeviceId, switcherDevices]);
  const userSecondaryText = useMemo(() => {
    if (user?.email) {
      return user.email;
    }

    if (user?.username) {
      return `@${user.username}`;
    }

    return `${currentLanguageLabel} · ${currentThemeLabel}`;
  }, [currentLanguageLabel, currentThemeLabel, user?.email, user?.username]);
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || 'U';
  const createEntryDropdownTriggerProps = {
    autoAlignPopupWidth: true,
    autoFitPosition: true,
    className: 'sider-create-menu-popup',
    duration: 0,
  };
  const userMenuDropdownTriggerProps = {
    autoAlignPopupWidth: true,
    autoFitPosition: true,
    className: 'sider-user-menu-popup',
    duration: 0,
    popupStyle: {
      maxHeight: 'calc(100vh - 24px)',
    },
  };
  const userSubMenuTriggerProps = {
    autoFitPosition: true,
    className: 'sider-user-submenu-popup',
    duration: 0,
    popupStyle: {
      maxHeight: 'min(320px, calc(100vh - 24px))',
      overflowY: 'auto' as const,
    },
  };
  const spaceMenuTriggerProps = {
    autoFitPosition: true,
    className: 'sider-user-submenu-popup',
    duration: 0,
    popupStyle: {
      maxHeight: 'min(360px, calc(100vh - 24px))',
      overflowY: 'auto' as const,
    },
  };
  const selectedSpaceName = selectedSpace?.name || (spacesLoading ? t('guid.space.loading') : t('guid.space.empty'));
  const selectedSpaceMeta = spacesLoading
    ? t('guid.space.loading')
    : selectedSpace
      ? t('guid.space.selectorTitle')
      : t('guid.space.empty');
  const spaceMenu = (
    <Menu
      className='sider-user-menu'
      onClickMenuItem={(key) => {
        if (key === 'space:open-vault') {
          void handleOpenSpaceVault();
          return;
        }

        if (key === 'space:create') {
          handleOpenCreateSpaceModal();
          return;
        }

        if (typeof key === 'string' && key.startsWith('space:')) {
          void handleSwitchSpace(key.slice('space:'.length));
        }
      }}
    >
      <Menu.Item key='space:open-vault'>
        <div className='sider-user-menu__row'>
          <span className='sider-user-menu__icon'>
            <FolderOpen theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />
          </span>
          <span className='sider-user-menu__row-text'>
            {openingSpaceVault ? t('common.processing') : t('guid.vault.affordance')}
          </span>
        </div>
      </Menu.Item>
      {spaces.map((space) => (
        <Menu.Item
          key={`space:${space.id}`}
          className={classNames(space.id === selectedSpace?.id && 'sider-user-menu__item--active')}
        >
          <div className='sider-user-menu__row'>
            <span className='sider-user-menu__icon'>
              <FolderOpen theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />
            </span>
            <span className='sider-user-menu__row-text'>{space.name}</span>
            {space.isDefault ? <span className='sider-user-menu__row-value'>{t('common.default')}</span> : null}
          </div>
        </Menu.Item>
      ))}
      <Menu.Item key='space:create'>
        <div className='sider-user-menu__row'>
          <span className='sider-user-menu__icon'>
            <Plus theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />
          </span>
          <span className='sider-user-menu__row-text'>{t('guid.space.newSpace')}</span>
        </div>
      </Menu.Item>
    </Menu>
  );
  const createEntryMenu = (
    <Menu
      className='sider-create-menu'
      onClickMenuItem={(key) => {
        if (key === 'conversation') {
          handleCreateConversation();
          return;
        }

        if (key === 'group') {
          handleCreateGroup();
        }
      }}
    >
      <Menu.Item key='conversation'>
        <div className='app-icon-row'>
          <span className='app-icon-slot'>
            <Plus theme='outline' size='16' fill={iconColors.primary} className='app-icon' />
          </span>
          <span className='min-w-0 truncate'>{t('conversation.entry.conversation')}</span>
        </div>
      </Menu.Item>
      <Menu.Item key='group'>
        <div className='app-icon-row'>
          <span className='app-icon-slot'>
            <Robot theme='outline' size='16' fill={iconColors.primary} className='app-icon' />
          </span>
          <span className='min-w-0 truncate'>{t('conversation.entry.group')}</span>
        </div>
      </Menu.Item>
    </Menu>
  );
  const userMenu = (
    <Menu
      className='sider-user-menu'
      triggerProps={userSubMenuTriggerProps}
      onClickMenuItem={(key) => {
        if (key === 'cloud:login') {
          handleOpenCloudLogin();
          return;
        }

        if (key === 'cloud:infermesh') {
          void handleOpenInfermesh();
          return;
        }

        if (key === 'cloud:logout') {
          void handleCloudLogout();
          return;
        }

        if (key === 'settings') {
          handleOpenSettings();
          return;
        }

        if (key === 'device-switch') {
          handleOpenDeviceSwitcher();
          return;
        }

        if (key === 'devtools') {
          handleToggleDevTools();
          return;
        }

        if (typeof key !== 'string') {
          return;
        }

        if (key.startsWith('language:')) {
          handleChangeLanguage(key.slice('language:'.length) as (typeof LANGUAGE_OPTIONS)[number]['value']);
          return;
        }

        if (key.startsWith('theme:')) {
          const nextTheme = key.slice('theme:'.length) as Theme;
          setTheme(nextTheme).catch((error: Error) => {
            console.error('Failed to change theme:', error);
          });
          setUserMenuVisible(false);
        }
      }}
    >
      <Menu.Item key='device-switch'>
        {renderUserMenuLabel(
          <Computer theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />,
          currentDeviceName,
          <Right theme='outline' size='14' fill={iconColors.secondary} className='app-icon shrink-0' />
        )}
      </Menu.Item>
      {cloudStatus?.user ? (
        <>
          <Menu.Item key='cloud:infermesh'>
            {renderUserMenuLabel(
              <img
                src={InfermeshMenuLogo}
                alt=''
                aria-hidden='true'
                className='h-16px w-16px shrink-0 rounded-6px object-contain'
              />,
              t('settings.cloud.openInfermesh')
            )}
          </Menu.Item>
        </>
      ) : (
        <>
          <Menu.Item key='cloud:login'>
            {renderUserMenuLabel(
              <LinkCloud theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />,
              t('settings.cloud.title'),
              t('settings.cloud.notConnected')
            )}
          </Menu.Item>
          <Menu.Item key='cloud:infermesh'>
            {renderUserMenuLabel(
              <img
                src={InfermeshMenuLogo}
                alt=''
                aria-hidden='true'
                className='h-16px w-16px shrink-0 rounded-6px object-contain'
              />,
              cloudActionLoading === 'infermesh' ? t('common.processing') : t('settings.cloud.openInfermesh')
            )}
          </Menu.Item>
        </>
      )}
      <Menu.Item key='devtools'>
        {renderUserMenuLabel(
          <Computer theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />,
          t('settings.devTools'),
          isDevToolsOpen ? t('settings.closeDevTools') : t('settings.openDevTools')
        )}
      </Menu.Item>
      <Menu.Item key='settings'>
        {renderUserMenuLabel(
          <SettingTwo theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />,
          t('common.settings')
        )}
      </Menu.Item>
      <Menu.SubMenu
        key='language'
        title={renderUserMenuLabel(
          <Earth theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />,
          t('settings.language'),
          currentLanguageLabel
        )}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <Menu.Item
            key={`language:${option.value}`}
            className={classNames(option.value === i18n.language && 'sider-user-menu__item--active')}
          >
            {renderUserMenuLabel(
              <Earth
                theme='outline'
                size='14'
                fill={option.value === i18n.language ? iconColors.primary : iconColors.secondary}
                className='app-icon shrink-0'
              />,
              option.label
            )}
          </Menu.Item>
        ))}
      </Menu.SubMenu>
      <Menu.SubMenu
        key='theme'
        title={renderUserMenuLabel(
          <ThemeIcon theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />,
          t('settings.theme'),
          currentThemeLabel
        )}
      >
        {themeOptions.map((option) => (
          <Menu.Item
            key={`theme:${option.value}`}
            className={classNames(option.value === theme && 'sider-user-menu__item--active')}
          >
            {renderUserMenuLabel(
              option.value === 'light' ? (
                <Sun theme='outline' size='14' fill={iconColors.primary} className='app-icon shrink-0' />
              ) : (
                <Moon theme='outline' size='14' fill={iconColors.primary} className='app-icon shrink-0' />
              ),
              option.label
            )}
          </Menu.Item>
        ))}
      </Menu.SubMenu>
      {cloudStatus?.user ? (
        <Menu.Item key='cloud:logout'>
          {renderUserMenuLabel(
            <LinkCloud theme='outline' size='16' fill={iconColors.primary} className='app-icon shrink-0' />,
            cloudActionLoading === 'logout' ? t('common.processing') : t('settings.cloud.signOut')
          )}
        </Menu.Item>
      ) : null}
    </Menu>
  );

  return (
    <div className='size-full w-full min-w-0 flex flex-col'>
      {/* Main content area */}
      <div className='flex-1 min-h-0 w-full min-w-0 overflow-hidden'>
        {isSettings ? (
          <Suspense fallback={<div className='size-full' />}>
            <div
              className={classNames(
                'size-full w-full min-w-0 flex flex-col sider-main-section',
                showDesktopChromeOverlayInset && 'sider-main-section--desktop-chrome-offset'
              )}
            >
              <SettingsSider collapsed={collapsed} tooltipEnabled={tooltipEnabled}></SettingsSider>
            </div>
          </Suspense>
        ) : (
          <div
            className={classNames(
              'size-full w-full min-w-0 flex flex-col sider-main-section',
              showDesktopChromeOverlayInset && 'sider-main-section--desktop-chrome-offset'
            )}
          >
            <div className='mb-10px flex shrink-0 w-full min-w-0 flex-col gap-6px'>
              <Dropdown
                droplist={createEntryMenu}
                trigger='click'
                position='bl'
                triggerProps={createEntryDropdownTriggerProps}
              >
                <button type='button' className={actionRowClassName}>
                  <Plus
                    theme='outline'
                    size='20'
                    fill={iconColors.primary}
                    className='app-icon block shrink-0 leading-none'
                  />
                  <span className='min-w-0 flex-1 truncate text-14px font-600 text-t-primary'>
                    {t('conversation.entry.create')}
                  </span>
                  <Down
                    theme='outline'
                    size='14'
                    fill={iconColors.secondary}
                    className='app-icon block shrink-0 leading-none'
                  />
                </button>
              </Dropdown>
              <ConversationSearchPopover
                onSessionClick={onSessionClick}
                onConversationSelect={handleConversationSelect}
                buttonLabel={t('conversation.historySearch.tooltip')}
                buttonClassName={classNames(actionRowClassName, '!justify-start !border-none')}
              />
              <button
                type='button'
                className={classNames(
                  actionRowClassName,
                  pathname.startsWith('/connectors') && 'sider-entry-row--active'
                )}
                onClick={() => handleNavigate('/connectors')}
                onMouseEnter={() => handlePreloadRoute('/connectors')}
                onFocus={() => handlePreloadRoute('/connectors')}
              >
                <ConnectionPoint
                  theme='outline'
                  size='20'
                  fill={iconColors.primary}
                  className='app-icon block shrink-0 leading-none'
                />
                <span className='min-w-0 truncate text-14px font-600 text-t-primary'>
                  {t('settings.connectors.title')}
                </span>
              </button>
              <button
                type='button'
                className={classNames(
                  actionRowClassName,
                  pathname === '/agents' || pathname.startsWith('/agents/')
                    ? 'sider-entry-row--active'
                    : null
                )}
                onClick={() => handleNavigate('/agents')}
                onMouseEnter={() => handlePreloadRoute('/agents')}
                onFocus={() => handlePreloadRoute('/agents')}
              >
                <RobotOne
                  theme='outline'
                  size='20'
                  fill={iconColors.primary}
                  className='app-icon block shrink-0 leading-none'
                />
                <span className='min-w-0 truncate text-14px font-600 text-t-primary'>{t('settings.assistants')}</span>
              </button>
            </div>
            <Suspense fallback={<div className='flex-1 min-h-0' />}>
              <WorkspaceGroupedHistory {...workspaceHistoryProps}></WorkspaceGroupedHistory>
            </Suspense>
            <CreateGroupModal
              visible={groupModalVisible}
              workspace={activeWorkspace}
              spaceId={selectedSpace?.id}
              cliAgents={cliAgents}
              presetAssistants={presetAssistants}
              onCancel={() => setGroupModalVisible(false)}
              onCreated={(conversation) => {
                setGroupModalVisible(false);
                openTab(conversation);
                void navigate(`/conversation/${conversation.id}`);
                emitter.emit('chat.history.refresh');
                if (onSessionClick) {
                  onSessionClick();
                }
              }}
            />
          </div>
        )}
      </div>
      <div className='sider-footer mt-auto shrink-0 pt-10px'>
        <div className='sider-space-card-wrap'>
          <Dropdown droplist={spaceMenu} trigger='click' position='tl' triggerProps={spaceMenuTriggerProps}>
            <button
              type='button'
              className={classNames('sider-space-card', isMobile && 'sider-footer-btn-mobile')}
              aria-label={t('guid.space.selectorTitle')}
              aria-haspopup='menu'
            >
              <span className='sider-space-card__summary'>
                <span className='sider-space-card__icon'>
                  <FolderOpen
                    theme='outline'
                    size='18'
                    fill={iconColors.primary}
                    className='app-icon block shrink-0 leading-none'
                  />
                </span>
                <span className='sider-space-card__content'>
                  <span className='sider-space-card__title'>{selectedSpaceName}</span>
                  <span className='sider-space-card__meta'>{selectedSpaceMeta}</span>
                </span>
              </span>
              <span className='sider-space-card__action'>
                <Down
                  theme='outline'
                  size='16'
                  fill={iconColors.secondary}
                  className='app-icon block shrink-0 leading-none'
                />
              </span>
            </button>
          </Dropdown>
        </div>
        <ContextGoModal
          visible={cloudLoginVisible}
          onCancel={handleCloseCloudLogin}
          className='cloud-login-modal'
          header={{
            title: t('settings.cloud.title'),
            showClose: true,
            className: 'px-20px pt-16px',
          }}
          footer={{
            className: 'px-20px pb-16px',
            render: () => (
              <div className='flex justify-end gap-10px pt-4px'>
                <Button onClick={handleCloseCloudLogin} disabled={Boolean(authLoadingProvider)}>
                  {t('common.cancel')}
                </Button>
              </div>
            ),
          }}
          style={{ width: '420px' }}
          contentStyle={{ padding: '0' }}
        >
          <div className='px-20px pb-16px'>
            <div className='flex flex-col gap-12px py-4px'>
              <div className='text-14px font-600 text-t-primary'>{t('settings.cloud.notConnected')}</div>
              <div className='text-13px leading-relaxed text-t-secondary'>{t('settings.cloud.notConnectedDesc')}</div>
              <div className='flex flex-wrap gap-10px pt-4px'>
                <Button
                  type='primary'
                  loading={authLoadingProvider === 'github'}
                  disabled={Boolean(authLoadingProvider)}
                  onClick={() => void handleCloudLogin('github')}
                >
                  {t('settings.cloud.loginWithGithub')}
                </Button>
                <Button
                  loading={authLoadingProvider === 'google'}
                  disabled={Boolean(authLoadingProvider)}
                  onClick={() => void handleCloudLogin('google')}
                >
                  {t('settings.cloud.loginWithGoogle')}
                </Button>
              </div>
            </div>
          </div>
        </ContextGoModal>
        <ContextGoModal
          visible={deviceSwitchVisible}
          onCancel={handleCloseDeviceSwitcher}
          className='device-switch-modal'
          header={{
            title: t('settings.webui.switchDevice'),
            showClose: true,
            className: 'px-20px pt-16px',
          }}
          footer={{
            className: 'px-20px pb-16px',
            render: () => (
              <div className='flex items-center justify-between gap-10px pt-4px'>
                {cloudStatus?.authenticated ? (
                  <Button
                    onClick={() => void loadRemoteDevices()}
                    disabled={remoteDevicesLoading || Boolean(openingRemoteDeviceId)}
                  >
                    {t('common.refresh')}
                  </Button>
                ) : (
                  <span />
                )}
                <Button onClick={handleCloseDeviceSwitcher} disabled={Boolean(openingRemoteDeviceId)}>
                  {t('common.cancel')}
                </Button>
              </div>
            ),
          }}
          style={{ width: '560px' }}
          contentStyle={{ padding: '0' }}
        >
          <div className='px-20px pb-16px'>
            {!cloudStatus?.authenticated ? (
              <div className='flex flex-col gap-12px py-4px'>
                <div className='text-14px font-600 text-t-primary'>{t('settings.cloud.notConnected')}</div>
                <div className='text-13px leading-relaxed text-t-secondary'>{t('settings.cloud.notConnectedDesc')}</div>
                <div className='flex flex-wrap gap-10px pt-4px'>
                  <Button
                    type='primary'
                    loading={authLoadingProvider === 'github'}
                    onClick={() => void handleCloudLogin('github')}
                  >
                    {t('settings.cloud.loginWithGithub')}
                  </Button>
                  <Button loading={authLoadingProvider === 'google'} onClick={() => void handleCloudLogin('google')}>
                    {t('settings.cloud.loginWithGoogle')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className='flex flex-col gap-12px py-4px'>
                <div className='text-13px leading-relaxed text-t-secondary'>
                  {t('settings.webui.switchDeviceDescription')}
                </div>
                {remoteDevicesError ? (
                  <div className='rounded-12px border border-danger/25 bg-danger/6 px-12px py-10px text-12px text-danger'>
                    {remoteDevicesError}
                  </div>
                ) : null}
                {remoteDevicesLoading && orderedRemoteDevices.length === 0 ? (
                  <div className='rounded-14px border border-line bg-fill-1 px-14px py-16px text-13px text-t-secondary'>
                    {t('settings.cloud.loading')}
                  </div>
                ) : null}
                {!remoteDevicesLoading && orderedRemoteDevices.length === 0 ? (
                  <div className='rounded-14px border border-line bg-fill-1 px-14px py-16px text-13px leading-relaxed text-t-secondary'>
                    {t('settings.webui.switchDeviceEmpty')}
                  </div>
                ) : null}
                {orderedRemoteDevices.length > 0 ? (
                  <div className='flex flex-col gap-10px'>
                    {orderedRemoteDevices.map((device) => {
                      const canOpenDevice = isOpenableRemoteDevice(device);
                      const isCurrentDevice = currentCloudDeviceId === device.id;
                      const statusKey = getRemoteDeviceStatusKey(device, cloudStatus, isCurrentDevice);
                      const lastSeen =
                        formatRemoteDeviceLastSeen(device.lastSeenAt, i18n.language) ||
                        t('settings.cloud.notAvailable');
                      const isHighlighted = preferredRemoteDeviceId === device.id && !isCurrentDevice;

                      return (
                        <div
                          key={device.id}
                          className={classNames(
                            'flex items-center gap-12px rounded-16px border px-14px py-12px transition-colors',
                            isHighlighted
                              ? 'border-[rgba(var(--primary-6),0.24)] bg-[rgba(var(--primary-6),0.06)]'
                              : 'border-line bg-fill-1'
                          )}
                        >
                          <div className='flex h-38px w-38px shrink-0 items-center justify-center rounded-12px bg-bg-2'>
                            <Computer
                              theme='outline'
                              size='18'
                              fill={iconColors.primary}
                              className='app-icon shrink-0'
                            />
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='flex flex-wrap items-center gap-8px'>
                              <span className='min-w-0 truncate text-14px font-600 text-t-primary'>
                                {device.deviceName}
                              </span>
                              {isCurrentDevice ? (
                                <span className='rounded-full bg-fill-2 px-8px py-2px text-11px font-600 text-t-secondary'>
                                  {t('settings.webui.switchDeviceCurrent')}
                                </span>
                              ) : null}
                            </div>
                            <div className='mt-4px flex flex-wrap items-center gap-6px text-12px text-t-secondary'>
                              <span className='uppercase tracking-[0.08em]'>{device.platform}</span>
                              <span>·</span>
                              <span>{t('settings.webui.switchDeviceLastSeen', { time: lastSeen })}</span>
                            </div>
                          </div>
                          <div className='flex shrink-0 items-center gap-10px'>
                            <span className='rounded-full bg-fill-2 px-8px py-2px text-11px font-600 text-t-secondary'>
                              {t(statusKey)}
                            </span>
                            {!isCurrentDevice && canOpenDevice ? (
                              <Button
                                type='primary'
                                size='small'
                                loading={openingRemoteDeviceId === device.id}
                                disabled={Boolean(openingRemoteDeviceId)}
                                onClick={() => handleOpenRemoteDevice(device.id)}
                              >
                                {t('settings.webui.switchDeviceOpen')}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </ContextGoModal>
        <ContextGoModal
          visible={spaceModalVisible}
          onCancel={handleCloseCreateSpaceModal}
          className='create-space-modal'
          header={{
            title: t('guid.space.createTitle'),
            showClose: true,
            className: 'px-20px pt-16px',
          }}
          footer={{
            className: 'px-20px pb-16px',
            render: () => (
              <div className='flex justify-end gap-10px pt-4px'>
                <Button onClick={handleCloseCreateSpaceModal} disabled={creatingSpace}>
                  {t('common.cancel')}
                </Button>
                <Button type='primary' loading={creatingSpace} onClick={() => void handleCreateSpace()}>
                  {t('guid.space.createAction')}
                </Button>
              </div>
            ),
          }}
          style={{ width: '420px' }}
          contentStyle={{ padding: '0' }}
        >
          <div className='sider-space-modal__body'>
            <div className='sider-space-modal__panel'>
              <div className='sider-space-modal__field'>
                <Input
                  value={newSpaceName}
                  onChange={setNewSpaceName}
                  placeholder={t('guid.space.namePlaceholder')}
                  maxLength={120}
                />
              </div>
              <div className='sider-space-modal__field'>
                <Input.TextArea
                  value={newSpaceDescription}
                  onChange={setNewSpaceDescription}
                  placeholder={t('guid.space.descriptionPlaceholder')}
                  maxLength={240}
                  autoSize={{ minRows: 3, maxRows: 5 }}
                />
              </div>
            </div>
          </div>
        </ContextGoModal>
        <div className='sider-user-card-wrap'>
          <Dropdown
            droplist={userMenu}
            trigger='click'
            position='tl'
            popupVisible={userMenuVisible}
            onVisibleChange={setUserMenuVisible}
            triggerProps={userMenuDropdownTriggerProps}
          >
            <button
              type='button'
              className={classNames(
                'sider-user-trigger',
                userMenuVisible && 'sider-user-trigger--active',
                isMobile && 'sider-footer-btn-mobile'
              )}
              aria-expanded={userMenuVisible}
            >
              <span className='sider-user-trigger__avatar'>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={userDisplayName} className='sider-user-trigger__avatar-image' />
                ) : (
                  userInitial
                )}
              </span>
              <span className='min-w-0 flex-1 text-left'>
                <span className='block truncate text-14px font-600 text-t-primary'>{userDisplayName}</span>
                {userSecondaryText ? (
                  <span className='block truncate text-12px text-t-secondary'>{userSecondaryText}</span>
                ) : null}
              </span>
              <Down
                theme='outline'
                size='16'
                fill={iconColors.secondary}
                className={classNames(
                  'sider-user-trigger__chevron',
                  userMenuVisible && 'sider-user-trigger__chevron--open'
                )}
              />
            </button>
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default Sider;
