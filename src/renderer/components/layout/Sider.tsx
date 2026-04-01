import { ipcBridge } from '@/common';
import { useThemeContext } from '@/renderer/hooks/context/ThemeContext';
import { changeLanguage } from '@/renderer/services/i18n';
import type { Theme } from '@/renderer/hooks/system/useTheme';
import {
  Computer,
  ConnectionPoint,
  Down,
  Earth,
  Lightning,
  Moon,
  Plus,
  Puzzle,
  Robot,
  RobotOne,
  SettingTwo,
  Sun,
  Theme as ThemeIcon,
} from '@icon-park/react';
import { Dropdown, Menu } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { iconColors } from '@renderer/styles/colors';
import { usePreviewContext } from '@renderer/pages/conversation/Preview/context/PreviewContext';
import { cleanupSiderTooltips } from '@renderer/utils/ui/siderTooltip';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { blurActiveElement } from '@renderer/utils/ui/focus';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import ConversationSearchPopover from '@renderer/pages/conversation/GroupedHistory/ConversationSearchPopover';
import { useConversationAgents } from '@renderer/pages/conversation/hooks/useConversationAgents';
import { useConversationTabs } from '@renderer/pages/conversation/hooks/ConversationTabsContext';
import CreateGroupModal from '@renderer/pages/conversation/platforms/group/CreateGroupModal';
import { emitter } from '@renderer/utils/emitter';
import { isElectronDesktop, isMacOS } from '@renderer/utils/platform';
import SpaceSwitcher from './Titlebar/SpaceSwitcher';
import { preloadRoutePath } from './routerLocation';

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

const renderUserMenuLabel = (icon: React.ReactNode, label: string, value?: string) => (
  <div className='sider-user-menu__row'>
    <span className='sider-user-menu__icon'>{icon}</span>
    <span className='sider-user-menu__row-text'>{label}</span>
    {value ? <span className='sider-user-menu__row-value'>{value}</span> : null}
  </div>
);

const Sider: React.FC<SiderProps> = ({ onSessionClick, collapsed = false }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const location = useLocation();
  const { pathname } = location;

  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemeContext();
  const navigate = useNavigate();
  const { closePreview } = usePreviewContext();
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [desktopUsername, setDesktopUsername] = useState('');
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const isSettings = pathname.startsWith('/settings');
  const isConversationRoute = pathname.startsWith('/conversation/');
  const isDesktopRuntime = isElectronDesktop();
  const showDesktopChromeOverlayInset = !isMobile && !isConversationRoute && (!isDesktopRuntime || isMacOS());
  const { cliAgents, presetAssistants } = useConversationAgents();
  const { activeTab, openTab } = useConversationTabs();
  const { user } = useAuth();

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
  const actionRowActiveClassName = 'sider-entry-row--active';
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
        if (key === 'settings') {
          handleOpenSettings();
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
                className={classNames(actionRowClassName, pathname === '/hooks' && actionRowActiveClassName)}
                onClick={() => handleNavigate('/hooks')}
                onMouseEnter={() => handlePreloadRoute('/hooks')}
                onFocus={() => handlePreloadRoute('/hooks')}
              >
                <Puzzle
                  theme='outline'
                  size='20'
                  fill={iconColors.primary}
                  className='app-icon block shrink-0 leading-none'
                />
                <span className='min-w-0 truncate text-14px font-600 text-t-primary'>
                  {t('settings.hooksPage', { defaultValue: 'Hooks' })}
                </span>
              </button>
              <button
                type='button'
                className={classNames(
                  actionRowClassName,
                  pathname.startsWith('/connectors') && actionRowActiveClassName
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
                className={classNames(actionRowClassName, pathname === '/skills-hub' && actionRowActiveClassName)}
                onClick={() => handleNavigate('/skills-hub')}
                onMouseEnter={() => handlePreloadRoute('/skills-hub')}
                onFocus={() => handlePreloadRoute('/skills-hub')}
              >
                <Lightning
                  theme='outline'
                  size='20'
                  fill={iconColors.primary}
                  className='app-icon block shrink-0 leading-none'
                />
                <span className='min-w-0 truncate text-14px font-600 text-t-primary'>
                  {t('settings.skillsHub.title')}
                </span>
              </button>
              <button
                type='button'
                className={classNames(actionRowClassName, pathname === '/agents' && actionRowActiveClassName)}
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
        <div className='sider-space-switcher-wrap mb-8px'>
          <SpaceSwitcher compact={collapsed && !isMobile} placement='sider' />
        </div>
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
                <span className='block truncate text-12px text-t-secondary'>{userSecondaryText}</span>
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
