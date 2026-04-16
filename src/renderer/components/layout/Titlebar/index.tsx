import React, { useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import {
  ArrowCircleLeft,
  Computer,
  Earth,
  ExpandLeft,
  ExpandRight,
  Left,
  MenuFold,
  MenuUnfold,
  Plus,
  Right,
  Robot,
} from '@icon-park/react';
import { Dropdown, Menu } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { ipcBridge } from '@/common';
import WindowControls from '../WindowControls';
import { WORKSPACE_STATE_EVENT, dispatchWorkspaceToggleEvent } from '@renderer/utils/workspace/workspaceEvents';
import type { WorkspaceStateDetail } from '@renderer/utils/workspace/workspaceEvents';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useRemoteAccessContext } from '@/renderer/hooks/context/RemoteAccessContext';
import { useSelectedSpaceId } from '@/renderer/hooks/context/useSelectedSpace';
import { isElectronDesktop, isMacOS, isMobileShellWebView } from '@/renderer/utils/platform';
import { useConversationAgents } from '@renderer/pages/conversation/hooks/useConversationAgents';
import { useConversationTabs } from '@renderer/pages/conversation/hooks/ConversationTabsContext';
import { normalizeConversationTitle } from '@renderer/pages/conversation/utils/newConversationName';
import CreateGroupModal from '@renderer/pages/conversation/platforms/group/CreateGroupModal';
import { emitter } from '@renderer/utils/emitter';
import { iconColors } from '@renderer/styles/colors';
import { dispatchSettingsNavDrawerEvent } from '@/renderer/pages/settings/components/settingsNavigation';
import './titlebar.css';

interface TitlebarProps {
  workspaceAvailable: boolean;
  leftPaneWidth: number;
}

const MOBILE_SHELL_CONVERSATION_TITLE_MAX_LENGTH = 14;
const IS_DEV_BUILD = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

const formatMobileShellConversationTitle = (title: string): string => {
  const normalizedTitle = normalizeConversationTitle(title);
  if (normalizedTitle.length <= MOBILE_SHELL_CONVERSATION_TITLE_MAX_LENGTH) {
    return normalizedTitle;
  }

  return `${normalizedTitle.slice(0, MOBILE_SHELL_CONVERSATION_TITLE_MAX_LENGTH - 1).trimEnd()}…`;
};

const Titlebar: React.FC<TitlebarProps> = ({ workspaceAvailable, leftPaneWidth }) => {
  const { t } = useTranslation();
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [mobileCenterTitle, setMobileCenterTitle] = useState('');
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [isRemoteModeBadgeHovered, setIsRemoteModeBadgeHovered] = useState(false);
  const layout = useLayoutContext();
  const remoteAccess = useRemoteAccessContext();
  const location = useLocation();
  const navigate = useNavigate();
  const lastNonSettingsPathRef = useRef('/guid');
  const isDesktopRuntime = isElectronDesktop();
  const isMacRuntime = isDesktopRuntime && isMacOS();
  const isMobileShellRuntime = !isDesktopRuntime && isMobileShellWebView();
  const { cliAgents, presetAssistants } = useConversationAgents();
  const { activeTab, openTab, openTabs } = useConversationTabs();
  const selectedSpaceId = useSelectedSpaceId();

  // 监听工作空间折叠状态，保持按钮图标一致 / Sync workspace collapsed state for toggle button
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<WorkspaceStateDetail>;
      if (typeof customEvent.detail?.collapsed === 'boolean') {
        setWorkspaceCollapsed(customEvent.detail.collapsed);
      }
    };
    window.addEventListener(WORKSPACE_STATE_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(WORKSPACE_STATE_EVENT, handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isDesktopRuntime) {
      setIsFullScreen(false);
      return undefined;
    }

    let isMounted = true;
    const timeoutIds: Array<ReturnType<typeof setTimeout>> = [];

    const syncWhenMounted = async () => {
      try {
        const state = await ipcBridge.windowControls.isFullScreen.invoke();
        if (isMounted) {
          setIsFullScreen(state);
        }
      } catch {
        if (isMounted) {
          setIsFullScreen(false);
        }
      }
    };

    void syncWhenMounted();
    timeoutIds.push(setTimeout(() => void syncWhenMounted(), 180));
    timeoutIds.push(setTimeout(() => void syncWhenMounted(), 720));

    const handleWindowFocus = () => {
      void syncWhenMounted();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncWhenMounted();
      }
    };

    const unsubscribe = ipcBridge.windowControls.fullScreenChanged.on(({ isFullScreen: nextIsFullScreen }) => {
      if (isMounted) {
        setIsFullScreen(nextIsFullScreen);
      }
    });

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      timeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
    };
  }, [isDesktopRuntime]);

  // Windows/Linux 显示自定义窗口按钮；桌面端统一在标题栏提供工作区切换入口
  const showWindowControls = isDesktopRuntime && !isMacRuntime;
  const isRemoteDesktopContext =
    remoteAccess?.target.mode === 'device-list' || remoteAccess?.target.mode === 'remote-device';
  const isRemoteDeviceShell = remoteAccess?.target.mode === 'remote-device';
  const showRemoteDeviceMinimalHostChrome = isRemoteDeviceShell;
  // Remote-device mode keeps only host-level runtime status and native controls.
  // The remote desktop already renders its own workspace/session header.
  const showWorkspaceButton =
    workspaceAvailable && (!layout?.isMobile || isMobileShellRuntime) && !showRemoteDeviceMinimalHostChrome;

  const workspaceTooltip = workspaceCollapsed
    ? t('common.expandMore', { defaultValue: 'Expand workspace' })
    : t('common.collapse', { defaultValue: 'Collapse workspace' });
  const newEntryTooltip = t('conversation.entry.create');
  const backToChatTooltip = t('common.back', { defaultValue: 'Back to Chat' });
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const isGuidRoute = location.pathname === '/guid' || location.pathname === '/';
  const showDesktopConversationTabs =
    !layout?.isMobile && workspaceAvailable && openTabs.length > 0 && !showRemoteDeviceMinimalHostChrome;
  const iconSize = layout?.isMobile ? 24 : 18;
  // Host chrome stays minimal for remote devices: mode badge + dev badge + window controls only.
  const showDesktopNavigationButtons = !showRemoteDeviceMinimalHostChrome;
  // 统一在标题栏左侧展示主侧栏开关 / Always expose sidebar toggle on titlebar left side
  const showSiderToggle =
    Boolean(layout?.setSiderCollapsed) &&
    !(layout?.isMobile && isSettingsRoute) &&
    !isRemoteDesktopContext &&
    !showRemoteDeviceMinimalHostChrome;
  const showBackToChatButton = Boolean(layout?.isMobile && isSettingsRoute);
  const showSettingsNavButton = Boolean(layout?.isMobile && isSettingsRoute);
  const showNewConversationButton = Boolean(layout?.isMobile && workspaceAvailable);
  const isMobileConversationRoute = Boolean(layout?.isMobile && location.pathname.startsWith('/conversation/'));
  const siderTooltip = layout?.siderCollapsed
    ? t('common.expandMore', { defaultValue: 'Expand sidebar' })
    : t('common.collapse', { defaultValue: 'Collapse sidebar' });
  const settingsNavTooltip = t('settings.mobileNavigation');
  const devBuildTooltip = t('common.devBuild');
  const desktopRuntimeStatusText = !isRemoteDesktopContext
    ? t('settings.webui.deviceModeLocal')
    : isRemoteModeBadgeHovered
      ? t('settings.webui.backToLocal')
      : remoteAccess?.target.mode === 'device-list'
        ? t('settings.webui.remoteDevicesNav')
        : t('settings.webui.deviceModeRemote');

  const handleSiderToggle = () => {
    if (!showSiderToggle || !layout?.setSiderCollapsed) return;
    layout.setSiderCollapsed(!layout.siderCollapsed);
  };

  const handleWorkspaceToggle = () => {
    if (!workspaceAvailable) {
      return;
    }
    dispatchWorkspaceToggleEvent();
  };

  const handleRemoteModeBadgeClick = () => {
    if (!isRemoteDesktopContext) {
      return;
    }

    void navigate('/guid');
  };

  const handleNavigateBack = () => {
    void navigate(-1);
  };

  const handleNavigateForward = () => {
    void navigate(1);
  };

  const handleCreateConversation = () => {
    void navigate('/guid');
  };

  const handleCreateGroup = () => {
    setGroupModalVisible(true);
  };

  const handleBackToChat = () => {
    const target = lastNonSettingsPathRef.current;
    if (target && !target.startsWith('/settings')) {
      void navigate(target);
      return;
    }
    void navigate(-1);
  };

  useEffect(() => {
    if (!isSettingsRoute) {
      const path = `${location.pathname}${location.search}${location.hash}`;
      lastNonSettingsPathRef.current = path;
      try {
        sessionStorage.setItem('aion:last-non-settings-path', path);
      } catch {
        // ignore
      }
      return;
    }
    try {
      const stored = sessionStorage.getItem('aion:last-non-settings-path');
      if (stored) {
        lastNonSettingsPathRef.current = stored;
      }
    } catch {
      // ignore
    }
  }, [isSettingsRoute, location.pathname, location.search, location.hash]);

  const mobileRouteTitle = useMemo(() => {
    if (!layout?.isMobile) {
      return '';
    }

    const path = location.pathname;

    if (path === '/guid' || path === '/' || path === '/login') {
      return t('login.brand', { defaultValue: 'ContextGo' });
    }

    if (path.startsWith('/conversation/')) {
      return t('conversation.entry.conversation');
    }

    if (path === '/search/conversations') {
      return t('conversation.historySearch.title');
    }

    if (path.startsWith('/connectors')) {
      return t('settings.connectors.title');
    }

    if (path === '/hooks' || path.startsWith('/settings/hooks')) {
      return t('settings.hooksPage');
    }

    if (path === '/agents' || path.startsWith('/settings/agent')) {
      return t('settings.assistants');
    }

    if (path === '/skills-hub' || path.startsWith('/settings/skills-hub')) {
      return t('settings.skillsHub.title');
    }

    if (path.startsWith('/settings/schedule')) {
      return t('schedule.scheduledTasks');
    }

    if (path.startsWith('/settings/runtime')) {
      return t('settings.runtimeManager.title', { defaultValue: 'Runtime' });
    }

    if (path.startsWith('/settings/channels') || path.startsWith('/settings/agent-entry')) {
      return t('settings.agentEntry');
    }

    if (path.startsWith('/settings/agent-publish') || path.startsWith('/settings/active-sessions')) {
      return t('settings.activeSessions');
    }

    if (path.startsWith('/settings/system-runs')) {
      return t('settings.systemRuns');
    }

    if (path.startsWith('/settings/system') || path.startsWith('/settings/display')) {
      return t('settings.system');
    }

    if (path.startsWith('/settings/about')) {
      return t('settings.about');
    }

    if (path.startsWith('/settings/ext/')) {
      return t('settings.title');
    }

    if (path.startsWith('/settings')) {
      return t('settings.title');
    }

    return t('login.brand', { defaultValue: 'ContextGo' });
  }, [layout?.isMobile, location.pathname, t]);

  const shouldLeftAlignMobileTitle = Boolean(
    layout?.isMobile &&
    mobileRouteTitle &&
    location.pathname !== '/guid' &&
    location.pathname !== '/' &&
    location.pathname !== '/login'
  );
  const shouldUseSecondaryMobileChrome = Boolean(
    layout?.isMobile &&
    mobileRouteTitle &&
    location.pathname !== '/guid' &&
    location.pathname !== '/' &&
    location.pathname !== '/login' &&
    !isMobileConversationRoute
  );

  useEffect(() => {
    if (!layout?.isMobile) {
      setMobileCenterTitle('');
      return;
    }

    const match = location.pathname.match(/^\/conversation\/([^/]+)/);
    const conversationId = match?.[1];
    if (!conversationId) {
      setMobileCenterTitle(mobileRouteTitle);
      return;
    }

    let cancelled = false;
    setMobileCenterTitle(mobileRouteTitle);
    void ipcBridge.conversation.get
      .invoke({ id: conversationId })
      .then((conversation) => {
        if (cancelled) return;
        setMobileCenterTitle(conversation?.name || mobileRouteTitle);
      })
      .catch(() => {
        if (cancelled) return;
        setMobileCenterTitle(mobileRouteTitle);
      });

    return () => {
      cancelled = true;
    };
  }, [layout?.isMobile, location.pathname, mobileRouteTitle]);

  const mobileCenterDisplayTitle = useMemo(() => {
    const normalizedTitle = normalizeConversationTitle(mobileCenterTitle, {
      fallbackTitle: mobileRouteTitle,
      maxLength: 80,
    });

    if (isMobileShellRuntime && isMobileConversationRoute) {
      return formatMobileShellConversationTitle(normalizedTitle);
    }

    return normalizedTitle;
  }, [isMobileConversationRoute, isMobileShellRuntime, mobileCenterTitle, mobileRouteTitle]);
  const mobileCenterAccessibleTitle = useMemo(
    () =>
      normalizeConversationTitle(mobileCenterTitle, {
        fallbackTitle: mobileRouteTitle,
        maxLength: 160,
      }),
    [mobileCenterTitle, mobileRouteTitle]
  );

  const showDesktopToolbar = showWorkspaceButton || showWindowControls;
  const showDesktopRightSection = showDesktopConversationTabs || showDesktopToolbar;
  const showDesktopChromeOnlyLayout =
    !layout?.isMobile && (showRemoteDeviceMinimalHostChrome || (!showDesktopConversationTabs && !showDesktopToolbar));
  const shouldDockDesktopLeftToPane = !layout?.isMobile && leftPaneWidth > 0;

  const desktopLeftSectionStyle: React.CSSProperties = useMemo(() => {
    if (layout?.isMobile) {
      return {};
    }

    const reserveMacTrafficLights = isMacRuntime && !isFullScreen;
    const visibleControlCount = [showSiderToggle, showDesktopNavigationButtons, showDesktopNavigationButtons].filter(
      Boolean
    ).length;
    const contentWidth = Math.max(visibleControlCount * 40, 56);
    const minimumWidth = reserveMacTrafficLights ? Math.max(contentWidth + 72, 120) : contentWidth + 16;
    if (!shouldDockDesktopLeftToPane) {
      return {
        paddingLeft: reserveMacTrafficLights ? '72px' : '8px',
        paddingRight: '8px',
      };
    }

    const effectiveWidth = Math.max(leftPaneWidth, minimumWidth);

    return {
      width: `${effectiveWidth}px`,
      minWidth: `${effectiveWidth}px`,
      paddingLeft: reserveMacTrafficLights ? '72px' : '8px',
      paddingRight: '8px',
    };
  }, [
    isFullScreen,
    isMacRuntime,
    layout?.isMobile,
    leftPaneWidth,
    shouldDockDesktopLeftToPane,
    showDesktopNavigationButtons,
    showSiderToggle,
  ]);

  const desktopDevBadge = IS_DEV_BUILD ? (
    <span className='app-titlebar__build-badge' title={devBuildTooltip} aria-label={devBuildTooltip}>
      {t('common.devBadge')}
    </span>
  ) : null;

  const desktopModeBadge = isRemoteDesktopContext ? (
    <button
      type='button'
      className={classNames(
        'app-titlebar__mode-badge',
        'app-titlebar__mode-badge--remote',
        'app-titlebar__mode-badge--interactive',
        isRemoteModeBadgeHovered && 'app-titlebar__mode-badge--hovered'
      )}
      title={desktopRuntimeStatusText}
      aria-label={desktopRuntimeStatusText}
      onClick={handleRemoteModeBadgeClick}
      onMouseEnter={() => setIsRemoteModeBadgeHovered(true)}
      onMouseLeave={() => setIsRemoteModeBadgeHovered(false)}
      onBlur={() => setIsRemoteModeBadgeHovered(false)}
    >
      {isRemoteModeBadgeHovered ? (
        <ArrowCircleLeft theme='outline' size={14} fill='currentColor' className='app-icon shrink-0' />
      ) : (
        <Earth theme='outline' size={14} fill='currentColor' className='app-icon shrink-0' />
      )}
    </button>
  ) : (
    <span
      className={classNames('app-titlebar__mode-badge', 'app-titlebar__mode-badge--local')}
      title={desktopRuntimeStatusText}
      aria-label={desktopRuntimeStatusText}
    >
      <Computer theme='outline' size={14} fill='currentColor' className='app-icon shrink-0' />
    </span>
  );

  const desktopLeftControls = (
    <div
      className={classNames(
        'app-titlebar__desktop-left',
        shouldDockDesktopLeftToPane && 'app-titlebar__desktop-left--docked'
      )}
      style={desktopLeftSectionStyle}
    >
      {showSiderToggle && (
        <button type='button' className='app-titlebar__button' onClick={handleSiderToggle} aria-label={siderTooltip}>
          {layout.siderCollapsed ? (
            <MenuUnfold theme='outline' size={iconSize} fill='currentColor' />
          ) : (
            <MenuFold theme='outline' size={iconSize} fill='currentColor' />
          )}
        </button>
      )}
      {showDesktopNavigationButtons ? (
        <button
          type='button'
          className='app-titlebar__button'
          onClick={handleNavigateBack}
          aria-label={t('common.goBack')}
        >
          <Left theme='outline' size={iconSize} fill='currentColor' />
        </button>
      ) : null}
      {showDesktopNavigationButtons ? (
        <button
          type='button'
          className='app-titlebar__button'
          onClick={handleNavigateForward}
          aria-label={t('common.forward')}
        >
          <Right theme='outline' size={iconSize} fill='currentColor' />
        </button>
      ) : null}
    </div>
  );

  const desktopRemoteHostChrome = (
    <div className='app-titlebar__floating-host-chrome'>{showWindowControls ? <WindowControls /> : null}</div>
  );

  const desktopStatusDock = (
    <div className='app-titlebar__status-dock'>
      {desktopDevBadge}
      {desktopModeBadge}
    </div>
  );

  if (!layout?.isMobile) {
    if (showDesktopChromeOnlyLayout) {
      return (
        <>
          <div
            className={classNames('app-titlebar app-titlebar--desktop-chrome-only', {
              'app-titlebar--desktop': isDesktopRuntime,
              'app-titlebar--mac': isMacRuntime,
            })}
          >
            {showRemoteDeviceMinimalHostChrome ? desktopRemoteHostChrome : desktopLeftControls}
          </div>
          {desktopStatusDock}
        </>
      );
    }

    return (
      <>
        <div
          className={classNames(
            'app-titlebar border-b border-[var(--border-base)]',
            shouldDockDesktopLeftToPane ? 'bg-2' : 'bg-1',
            {
              'app-titlebar--desktop': isDesktopRuntime,
              'app-titlebar--mac': isMacRuntime,
            }
          )}
        >
          {isDesktopRuntime ? <div className='app-titlebar__top-drag-strip' aria-hidden='true' /> : null}
          {desktopLeftControls}
          {showDesktopRightSection && (
            <div
              className={classNames(
                'app-titlebar__desktop-right',
                showDesktopConversationTabs && 'app-titlebar__desktop-right--conversation'
              )}
            >
              {showDesktopConversationTabs ? (
                <div className='app-titlebar__desktop-content app-titlebar__desktop-content--conversation'>
                  <div id='app-titlebar-chat-slot' className='h-full min-w-0' />
                  {isDesktopRuntime ? <div className='app-titlebar__drag-spacer' aria-hidden='true' /> : null}
                </div>
              ) : isDesktopRuntime ? (
                <div className='app-titlebar__drag-spacer' aria-hidden='true' />
              ) : null}
              {showDesktopToolbar && (
                <div className='app-titlebar__toolbar app-titlebar__toolbar--desktop'>
                  <div className='app-titlebar__toolbar-actions'>
                    <div id='app-titlebar-toolbar-slot' className='app-titlebar__toolbar-slot' />

                    {showWorkspaceButton && (
                      <div className='app-titlebar__toolbar-chip-slot'>
                        <button
                          type='button'
                          className='app-header-pill-button app-titlebar__toolbar-chip-button'
                          onClick={handleWorkspaceToggle}
                          aria-label={workspaceTooltip}
                          title={workspaceTooltip}
                        >
                          <span className='app-header-pill'>
                            <span className='app-header-pill__icon'>
                              {workspaceCollapsed ? (
                                <ExpandRight theme='outline' size={16} fill='currentColor' />
                              ) : (
                                <ExpandLeft theme='outline' size={16} fill='currentColor' />
                              )}
                            </span>
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  {showWindowControls && <WindowControls />}
                </div>
              )}
            </div>
          )}
        </div>
        {desktopStatusDock}
      </>
    );
  }

  const activeWorkspace = activeTab?.workspace || '';
  const createEntryMenu = (
    <Menu
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
          <Plus theme='outline' size={16} fill={iconColors.primary} />
          <span>{t('conversation.entry.conversation')}</span>
        </div>
      </Menu.Item>
      <Menu.Item key='group'>
        <div className='flex items-center gap-8px'>
          <Robot theme='outline' size={16} fill={iconColors.primary} />
          <span>{t('conversation.entry.group')}</span>
        </div>
      </Menu.Item>
    </Menu>
  );

  return (
    <>
      <div
        className={classNames('flex items-center gap-8px app-titlebar bg-2 border-b border-[var(--border-base)]', {
          'app-titlebar--mobile': layout?.isMobile && !isMobileShellRuntime,
          'app-titlebar--mobile-shell': layout?.isMobile && isMobileShellRuntime,
          'app-titlebar--mobile-home': layout?.isMobile && isGuidRoute,
          'app-titlebar--mobile-secondary': shouldUseSecondaryMobileChrome,
          'app-titlebar--mobile-settings': layout?.isMobile && isSettingsRoute,
          'app-titlebar--mobile-conversation': layout?.isMobile && workspaceAvailable,
          'app-titlebar--desktop': isDesktopRuntime,
          'app-titlebar--mac': isMacRuntime,
        })}
      >
        <div className='app-titlebar__menu'>
          {showBackToChatButton && (
            <button
              type='button'
              className={classNames('app-titlebar__button', layout?.isMobile && 'app-titlebar__button--mobile')}
              onClick={handleBackToChat}
              aria-label={backToChatTooltip}
            >
              <ArrowCircleLeft theme='outline' size={iconSize} fill='currentColor' />
            </button>
          )}
          {showSiderToggle && (
            <button
              type='button'
              className={classNames('app-titlebar__button', layout?.isMobile && 'app-titlebar__button--mobile')}
              onClick={handleSiderToggle}
              aria-label={siderTooltip}
            >
              {layout?.siderCollapsed ? (
                <MenuUnfold theme='outline' size={iconSize} fill='currentColor' />
              ) : (
                <MenuFold theme='outline' size={iconSize} fill='currentColor' />
              )}
            </button>
          )}
        </div>
        <div
          className={classNames('app-titlebar__brand', shouldLeftAlignMobileTitle && 'app-titlebar__brand--leading')}
          aria-label={mobileCenterAccessibleTitle}
          title={mobileCenterAccessibleTitle}
        >
          {layout?.isMobile && mobileCenterDisplayTitle ? (
            <span className='app-titlebar__brand-text'>{mobileCenterDisplayTitle}</span>
          ) : null}
        </div>
        <div className='app-titlebar__toolbar'>
          {showSettingsNavButton && (
            <button
              type='button'
              className={classNames('app-titlebar__button', layout?.isMobile && 'app-titlebar__button--mobile')}
              onClick={() => dispatchSettingsNavDrawerEvent({ open: true })}
              aria-label={settingsNavTooltip}
            >
              <MenuUnfold theme='outline' size={iconSize} fill='currentColor' />
            </button>
          )}
          {showNewConversationButton && (
            <Dropdown droplist={createEntryMenu} trigger='click' position='bl'>
              <button
                type='button'
                className={classNames('app-titlebar__button', layout?.isMobile && 'app-titlebar__button--mobile')}
                aria-label={newEntryTooltip}
              >
                <Plus theme='outline' size={iconSize} fill='currentColor' />
              </button>
            </Dropdown>
          )}
          {showWorkspaceButton && (
            <button
              type='button'
              className={classNames('app-titlebar__button', layout?.isMobile && 'app-titlebar__button--mobile')}
              onClick={handleWorkspaceToggle}
              aria-label={workspaceTooltip}
            >
              {workspaceCollapsed ? (
                <ExpandRight theme='outline' size={iconSize} fill='currentColor' />
              ) : (
                <ExpandLeft theme='outline' size={iconSize} fill='currentColor' />
              )}
            </button>
          )}
          {showWindowControls && <WindowControls />}
        </div>
      </div>
      <CreateGroupModal
        visible={groupModalVisible}
        workspace={activeWorkspace}
        spaceId={selectedSpaceId ?? undefined}
        cliAgents={cliAgents}
        presetAssistants={presetAssistants}
        onCancel={() => setGroupModalVisible(false)}
        onCreated={(conversation) => {
          setGroupModalVisible(false);
          openTab(conversation);
          void navigate(`/conversation/${conversation.id}`);
          emitter.emit('chat.history.refresh');
        }}
      />
    </>
  );
};

export default Titlebar;
