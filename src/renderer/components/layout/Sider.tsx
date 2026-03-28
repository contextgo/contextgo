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
  Robot,
  RobotOne,
  SettingTwo,
  Sun,
  Theme as ThemeIcon,
} from '@icon-park/react';
import { Dropdown, Menu } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { Suspense, useEffect, useState } from 'react';
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
  const { cliAgents, presetAssistants } = useConversationAgents();
  const { activeTab, openTab } = useConversationTabs();
  const { user } = useAuth();

  const handleNavigate = (target: string) => {
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
        setDesktopUsername(homePath.split(/[\\/]/).filter(Boolean).pop() || '');
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
  const userDisplayName = desktopUsername || user?.username || t('common.localUser');
  const userInitial = userDisplayName.trim().charAt(0).toUpperCase() || 'U';
  const currentLanguageLabel =
    LANGUAGE_OPTIONS.find((option) => option.value === i18n.language)?.label ||
    LANGUAGE_OPTIONS.find((option) => option.value === 'en-US')?.label ||
    'English';
  const themeOptions: Array<{ value: Theme; label: string }> = [
    { value: 'light', label: t('settings.lightMode') },
    { value: 'dark', label: t('settings.darkMode') },
  ];
  const currentThemeLabel = themeOptions.find((option) => option.value === theme)?.label || t('settings.theme');
  const createEntryDropdownTriggerProps = {
    autoAlignPopupWidth: true,
    autoFitPosition: true,
    className: 'sider-create-menu-popup',
  };
  const userMenuDropdownTriggerProps = {
    autoAlignPopupWidth: true,
    autoFitPosition: true,
    className: 'sider-user-menu-popup',
    popupStyle: {
      maxHeight: 'calc(100vh - 24px)',
    },
  };
  const userSubMenuTriggerProps = {
    autoFitPosition: true,
    className: 'sider-user-submenu-popup',
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
        <div className='flex items-center gap-8px'>
          <Plus theme='outline' size='16' fill={iconColors.primary} />
          <span>{t('conversation.entry.conversation')}</span>
        </div>
      </Menu.Item>
      <Menu.Item key='group'>
        <div className='flex items-center gap-8px'>
          <Robot theme='outline' size='16' fill={iconColors.primary} />
          <span>{t('conversation.entry.group')}</span>
        </div>
      </Menu.Item>
    </Menu>
  );
  const renderUserMenuLabel = (icon: React.ReactNode, label: string, value?: string) => (
    <div className='sider-user-menu__row'>
      <span className='sider-user-menu__icon'>{icon}</span>
      <span className='sider-user-menu__row-text'>{label}</span>
      {value ? <span className='sider-user-menu__row-value'>{value}</span> : null}
    </div>
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
          <Computer theme='outline' size='16' fill={iconColors.primary} className='shrink-0' />,
          t('settings.devTools'),
          isDevToolsOpen ? t('settings.closeDevTools') : t('settings.openDevTools')
        )}
      </Menu.Item>
      <Menu.Item key='settings'>
        {renderUserMenuLabel(
          <SettingTwo theme='outline' size='16' fill={iconColors.primary} className='shrink-0' />,
          t('common.settings')
        )}
      </Menu.Item>
      <Menu.SubMenu
        key='language'
        title={renderUserMenuLabel(
          <Earth theme='outline' size='16' fill={iconColors.primary} className='shrink-0' />,
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
                className='shrink-0'
              />,
              option.label
            )}
          </Menu.Item>
        ))}
      </Menu.SubMenu>
      <Menu.SubMenu
        key='theme'
        title={renderUserMenuLabel(
          <ThemeIcon theme='outline' size='16' fill={iconColors.primary} className='shrink-0' />,
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
                <Sun theme='outline' size='14' fill={iconColors.primary} className='shrink-0' />
              ) : (
                <Moon theme='outline' size='14' fill={iconColors.primary} className='shrink-0' />
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
            <SettingsSider collapsed={collapsed} tooltipEnabled={tooltipEnabled}></SettingsSider>
          </Suspense>
        ) : (
          <div className='size-full w-full min-w-0 flex flex-col'>
            <div className='mb-10px flex shrink-0 w-full min-w-0 flex-col gap-6px'>
              <Dropdown
                droplist={createEntryMenu}
                trigger='click'
                position='bl'
                triggerProps={createEntryDropdownTriggerProps}
              >
                <button type='button' className={actionRowClassName}>
                  <Plus theme='outline' size='20' fill={iconColors.primary} className='block shrink-0 leading-none' />
                  <span className='min-w-0 flex-1 truncate text-14px font-600 text-t-primary'>
                    {t('conversation.entry.create')}
                  </span>
                  <Down theme='outline' size='14' fill={iconColors.secondary} className='block shrink-0 leading-none' />
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
                  pathname.startsWith('/connectors') && actionRowActiveClassName
                )}
                onClick={() => handleNavigate('/connectors')}
              >
                <ConnectionPoint
                  theme='outline'
                  size='20'
                  fill={iconColors.primary}
                  className='block shrink-0 leading-none'
                />
                <span className='min-w-0 truncate text-14px font-600 text-t-primary'>
                  {t('settings.connectors.title')}
                </span>
              </button>
              <button
                type='button'
                className={classNames(actionRowClassName, pathname === '/skills-hub' && actionRowActiveClassName)}
                onClick={() => handleNavigate('/skills-hub')}
              >
                <Lightning
                  theme='outline'
                  size='20'
                  fill={iconColors.primary}
                  className='block shrink-0 leading-none'
                />
                <span className='min-w-0 truncate text-14px font-600 text-t-primary'>
                  {t('settings.skillsHub.title')}
                </span>
              </button>
              <button
                type='button'
                className={classNames(actionRowClassName, pathname === '/agents' && actionRowActiveClassName)}
                onClick={() => handleNavigate('/agents')}
              >
                <RobotOne theme='outline' size='20' fill={iconColors.primary} className='block shrink-0 leading-none' />
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
              <span className='sider-user-trigger__avatar'>{userInitial}</span>
              <span className='min-w-0 flex-1 text-left'>
                <span className='block truncate text-14px font-600 text-t-primary'>{userDisplayName}</span>
                <span className='block truncate text-12px text-t-secondary'>
                  {currentLanguageLabel} · {currentThemeLabel}
                </span>
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
