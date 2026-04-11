/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage, type ICssTheme } from '@/common/config/storage';
import PwaPullToRefresh from '@/renderer/components/layout/PwaPullToRefresh';
import Titlebar from '@/renderer/components/layout/Titlebar';
import { Layout as ArcoLayout } from '@arco-design/web-react';
import classNames from 'classnames';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useDeepLink } from '@renderer/hooks/system/useDeepLink';
import { useNotificationClick } from '@renderer/hooks/system/useNotificationClick';
import { useDirectorySelection } from '@renderer/hooks/file/useDirectorySelection';
import { useMultiAgentDetection } from '@renderer/hooks/agent/useMultiAgentDetection';
import { processCustomCss } from '@renderer/utils/theme/customCssProcessor';
import { cleanupSiderTooltips } from '@renderer/utils/ui/siderTooltip';
import { useConversationShortcuts } from '@renderer/hooks/ui/useConversationShortcuts';
import { isElectronDesktop, isMobileShellWebView } from '@renderer/utils/platform';
import { computeCssSyncDecision, resolveCssByActiveTheme } from '@renderer/utils/theme/themeCssSync';
import '@renderer/styles/layout.css';

const UpdateModal = React.lazy(() => import('@/renderer/components/settings/UpdateModal'));

const DEFAULT_SIDER_WIDTH = 250;
const MOBILE_SIDER_WIDTH_RATIO = 0.67;
const MOBILE_SIDER_MIN_WIDTH = 260;
const MOBILE_SIDER_MAX_WIDTH = 420;
const MOBILE_SIDER_EDGE_SWIPE_ZONE = 28;
const MOBILE_SIDER_GESTURE_TRIGGER_RATIO = 0.35;
const MOBILE_SIDER_GESTURE_MIN_DISTANCE = 72;

type MobileTopChromeMode = 'home' | 'conversation' | 'settings' | 'default';

type MobileSiderGesture = {
  mode: 'opening' | 'closing';
  startX: number;
  startY: number;
};

const detectMobileViewportOrTouch = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (isElectronDesktop()) {
    return window.innerWidth < 768;
  }
  const width = window.innerWidth;
  const byWidth = width < 768;
  // 仅在小屏时才将 coarse/touch 视为移动端，避免触控笔记本被误判
  // Treat touch/coarse pointer as mobile only on smaller viewports
  const smallScreen = width < 1024;
  const byMedia = window.matchMedia('(hover: none)').matches || window.matchMedia('(pointer: coarse)').matches;
  const byTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  return byWidth || (smallScreen && (byMedia || byTouchPoints));
};

const resolveMobileTopChromeMode = (pathname: string): MobileTopChromeMode => {
  if (pathname === '/guid' || pathname === '/') {
    return 'home';
  }

  if (pathname.startsWith('/settings')) {
    return 'settings';
  }

  if (pathname.startsWith('/conversation/')) {
    return 'conversation';
  }

  return 'default';
};

const resolveMobileThemeColor = (mode: MobileTopChromeMode, isDarkTheme: boolean): string => {
  if (mode === 'home') {
    return isDarkTheme ? '#1b2331' : '#e8f1ff';
  }

  if (mode === 'conversation') {
    return isDarkTheme ? '#1c2129' : '#f6f8fb';
  }

  if (mode === 'settings') {
    return isDarkTheme ? '#161b22' : '#f7f8fb';
  }

  return isDarkTheme ? '#161b22' : '#f7f8fb';
};

const Layout: React.FC<{
  sider: React.ReactNode;
  onSessionClick?: () => void;
}> = ({ sider, onSessionClick: _onSessionClick }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 390 : window.innerWidth
  );
  const [customCss, setCustomCss] = useState<string>('');
  const [shouldMountUpdateModal, setShouldMountUpdateModal] = useState(false);
  const { contextHolder: multiAgentContextHolder } = useMultiAgentDetection();
  const { contextHolder: directorySelectionContextHolder } = useDirectorySelection();
  useDeepLink();
  useNotificationClick();
  const navigate = useNavigate();
  useConversationShortcuts({ navigate });
  const location = useLocation();
  const isSettingsRoute = location.pathname.startsWith('/settings');
  const isConversationDetailRoute = location.pathname.startsWith('/conversation/');
  const isMobileShellRuntime = !isElectronDesktop() && isMobileShellWebView();
  const workspaceAvailable = isConversationDetailRoute;
  const mobileTopChromeMode = useMemo(() => resolveMobileTopChromeMode(location.pathname), [location.pathname]);
  const collapsedRef = useRef(collapsed);
  const lastCssRef = useRef('');
  const lastUiCssUpdateAtRef = useRef(0);
  const mobileSiderGestureRef = useRef<MobileSiderGesture | null>(null);
  const [mobileSiderTranslateX, setMobileSiderTranslateX] = useState<number | null>(null);
  const [isDraggingMobileSider, setIsDraggingMobileSider] = useState(false);

  const loadAndHealCustomCss = useCallback(async () => {
    try {
      const [savedCssRaw, activeThemeId, savedThemes] = await Promise.all([
        ConfigStorage.get('customCss'),
        ConfigStorage.get('css.activeThemeId'),
        ConfigStorage.get('css.themes'),
      ]);

      const decision = computeCssSyncDecision({
        savedCss: savedCssRaw || '',
        activeThemeId: activeThemeId || '',
        savedThemes: (savedThemes || []) as ICssTheme[],
        currentUiCss: customCss,
        lastUiCssUpdateAt: lastUiCssUpdateAtRef.current,
      });

      if (decision.shouldSkipApply) {
        return;
      }

      let effectiveCss = decision.effectiveCss;

      // If the active theme resolved to empty CSS and there IS a saved activeThemeId
      // (but it no longer matches any known theme), fall back to default and persist.
      if (!effectiveCss && activeThemeId && activeThemeId !== 'default-theme') {
        const defaultCss = resolveCssByActiveTheme('default-theme', (savedThemes || []) as ICssTheme[]);
        effectiveCss = defaultCss;
        // Persist the fallback so Layout doesn't keep retrying
        await Promise.all([
          ConfigStorage.set('css.activeThemeId', 'default-theme'),
          ConfigStorage.set('customCss', effectiveCss),
        ]).catch((error) => {
          console.warn('Failed to persist theme fallback:', error);
        });
      } else if (decision.shouldHealStorage) {
        await ConfigStorage.set('customCss', effectiveCss).catch((error) => {
          console.warn('Failed to heal custom CSS from active theme:', error);
        });
      }

      setCustomCss(effectiveCss);
      if (lastCssRef.current !== effectiveCss) {
        lastCssRef.current = effectiveCss;
        window.dispatchEvent(new CustomEvent('custom-css-updated', { detail: { customCss: effectiveCss } }));
      }
    } catch (error) {
      console.error('Failed to load or heal custom CSS:', error);
    }
  }, [customCss]);

  // 加载并监听自定义 CSS 配置 / Load & watch custom CSS configuration
  useEffect(() => {
    void loadAndHealCustomCss();

    const handleCssUpdate = (event: CustomEvent) => {
      if (event.detail?.customCss !== undefined) {
        const css = event.detail.customCss || '';
        lastCssRef.current = css;
        lastUiCssUpdateAtRef.current = Date.now();
        setCustomCss(css);
      }
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && (event.key.includes('customCss') || event.key.includes('css.activeThemeId'))) {
        void loadAndHealCustomCss();
      }
    };

    window.addEventListener('custom-css-updated', handleCssUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('custom-css-updated', handleCssUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadAndHealCustomCss]);

  // Re-sync theme css on route changes, because some settings pages do not mount CssThemeSettings.
  useEffect(() => {
    void loadAndHealCustomCss();
  }, [location.pathname, location.search, location.hash, loadAndHealCustomCss]);

  // 注入自定义 CSS / Inject custom CSS into document head
  useEffect(() => {
    const styleId = 'user-defined-custom-css';

    if (!customCss) {
      document.getElementById(styleId)?.remove();
      return;
    }

    const wrappedCss = processCustomCss(customCss);

    const ensureStyleAtEnd = () => {
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

      if (styleEl && styleEl.textContent === wrappedCss && styleEl === document.head.lastElementChild) {
        return;
      }

      styleEl?.remove();
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.type = 'text/css';
      styleEl.textContent = wrappedCss;
      document.head.appendChild(styleEl);
    };

    ensureStyleAtEnd();

    const observer = new MutationObserver((mutations) => {
      const hasNewStyle = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => node.nodeName === 'STYLE' || node.nodeName === 'LINK')
      );

      if (hasNewStyle) {
        const element = document.getElementById(styleId);
        if (element && element !== document.head.lastElementChild) {
          ensureStyleAtEnd();
        }
      }
    });

    observer.observe(document.head, { childList: true });

    return () => {
      observer.disconnect();
      document.getElementById(styleId)?.remove();
    };
  }, [customCss]);

  // 检测移动端并响应窗口大小变化
  useEffect(() => {
    const checkMobile = () => {
      const mobile = detectMobileViewportOrTouch();
      setIsMobile(mobile);
      setViewportWidth(window.innerWidth);
    };

    // 初始检测
    checkMobile();

    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 进入移动端后立即折叠 / Collapse immediately when switching to mobile
  useEffect(() => {
    if (!isMobile || collapsedRef.current) {
      return;
    }
    setCollapsed(true);
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || !isSettingsRoute || !collapsedRef.current) {
      return;
    }

    setCollapsed(false);
  }, [isMobile, isSettingsRoute]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
    const themeColor = resolveMobileThemeColor(isMobile ? mobileTopChromeMode : 'default', isDarkTheme);
    let themeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");

    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.content = themeColor;
  }, [isMobile, mobileTopChromeMode]);

  // 清理侧栏 Tooltip 残留节点，避免移动端路由切换后浮层卡在左上角
  useEffect(() => {
    cleanupSiderTooltips();
  }, [isMobile, collapsed, location.pathname, location.search, location.hash]);

  // Bridge Main Process logs to F12 Console
  useEffect(() => {
    const unsubscribe = ipcBridge.application.logStream.on((entry) => {
      const prefix = `%c[Main:${entry.tag}]%c ${entry.message}`;
      const style = 'color:#7c3aed;font-weight:bold';
      if (entry.level === 'error') {
        console.error(prefix, style, 'color:inherit', ...(entry.data !== undefined ? [entry.data] : []));
      } else if (entry.level === 'warn') {
        console.warn(prefix, style, 'color:inherit', ...(entry.data !== undefined ? [entry.data] : []));
      } else {
        console.log(prefix, style, 'color:inherit', ...(entry.data !== undefined ? [entry.data] : []));
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle tray events from main process / 处理来自主进程的托盘事件
  useEffect(() => {
    if (!isElectronDesktop()) return;

    // Navigate to guid page when requested from tray / 托盘请求导航到 guid 页面
    const handleNavigateToGuid = () => {
      void navigate('/guid');
    };

    // Navigate to conversation when requested from tray / 托盘请求导航到对话页面
    const handleNavigateToConversation = (event: CustomEvent<{ conversationId: string }>) => {
      void navigate(`/conversation/${event.detail.conversationId}`);
    };

    // Open about dialog when requested from tray / 托盘请求打开关于对话框
    const handleOpenAbout = () => {
      // Navigate to settings/about page / 导航到设置/关于页面
      void navigate('/settings/about');
    };

    // Handle pause all tasks request from tray / 托盘请求暂停所有任务
    const handlePauseAllTasks = async () => {
      const { ipcBridge } = await import('@/common');
      const result = await ipcBridge.task.stopAll.invoke();
      if (result?.success) {
        // Navigate to settings page to show task status
        void navigate('/settings/system');
      }
    };

    // Handle check update request from tray / 托盘请求检查更新
    // 1. Navigate to about page / 导航到关于页面
    // 2. Trigger update modal check / 触发更新模态框检查
    const handleCheckUpdate = () => {
      void navigate('/settings/about');
      // Trigger update modal after a short delay to ensure page is loaded
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('contextgo-open-update-modal', { detail: { source: 'tray' } }));
      }, 100);
    };

    // Listen for tray events / 监听托盘事件
    window.addEventListener('tray:navigate-to-guid', handleNavigateToGuid as EventListener);
    window.addEventListener('tray:navigate-to-conversation', handleNavigateToConversation as EventListener);
    window.addEventListener('tray:open-about', handleOpenAbout as EventListener);
    window.addEventListener('tray:pause-all-tasks', handlePauseAllTasks as EventListener);
    window.addEventListener('tray:check-update', handleCheckUpdate as EventListener);

    return () => {
      window.removeEventListener('tray:navigate-to-guid', handleNavigateToGuid as EventListener);
      window.removeEventListener('tray:navigate-to-conversation', handleNavigateToConversation as EventListener);
      window.removeEventListener('tray:open-about', handleOpenAbout as EventListener);
      window.removeEventListener('tray:pause-all-tasks', handlePauseAllTasks as EventListener);
      window.removeEventListener('tray:check-update', handleCheckUpdate as EventListener);
    };
  }, [navigate]);

  const siderWidth = isMobile
    ? Math.max(
        MOBILE_SIDER_MIN_WIDTH,
        Math.min(MOBILE_SIDER_MAX_WIDTH, Math.round(viewportWidth * MOBILE_SIDER_WIDTH_RATIO))
      )
    : DEFAULT_SIDER_WIDTH;
  const showPrimarySider = true;
  const desktopExpandedSiderWidth = siderWidth;
  const desktopCollapsedSiderWidth = 0;
  const resolvedMobileSiderTranslateX = isMobile ? (mobileSiderTranslateX ?? (collapsed ? -siderWidth : 0)) : 0;
  const mobileSiderOpenProgress = isMobile
    ? Math.min(1, Math.max(0, (resolvedMobileSiderTranslateX + siderWidth) / siderWidth))
    : 1;
  const leftOffset = isMobile
    ? 0
    : showPrimarySider
      ? (collapsed ? desktopCollapsedSiderWidth : desktopExpandedSiderWidth) + 16
      : 16;
  const appShellStyle = {
    '--app-left-offset': `${leftOffset}px`,
  } as React.CSSProperties;
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);

  useEffect(() => {
    if (!isMobile) {
      mobileSiderGestureRef.current = null;
      setIsDraggingMobileSider(false);
      setMobileSiderTranslateX(null);
      return;
    }

    setMobileSiderTranslateX(null);
    setIsDraggingMobileSider(false);
  }, [collapsed, isMobile, siderWidth]);

  const resetMobileSiderGesture = useCallback(() => {
    mobileSiderGestureRef.current = null;
    setIsDraggingMobileSider(false);
    setMobileSiderTranslateX(null);
  }, []);

  const handleMobileSiderTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (!isMobile || !showPrimarySider || event.touches.length !== 1 || isMobileShellRuntime) {
        return;
      }

      const touch = event.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;

      if (collapsed) {
        if (startX > MOBILE_SIDER_EDGE_SWIPE_ZONE) {
          return;
        }

        mobileSiderGestureRef.current = {
          mode: 'opening',
          startX,
          startY,
        };
        setIsDraggingMobileSider(true);
        setMobileSiderTranslateX(-siderWidth);
        return;
      }

      if (startX > siderWidth) {
        return;
      }

      mobileSiderGestureRef.current = {
        mode: 'closing',
        startX,
        startY,
      };
      setIsDraggingMobileSider(true);
      setMobileSiderTranslateX(0);
    },
    [collapsed, isMobile, isMobileShellRuntime, showPrimarySider, siderWidth]
  );

  const handleMobileSiderTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const gesture = mobileSiderGestureRef.current;
      if (!gesture || event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      if (Math.abs(deltaY) > Math.abs(deltaX) + 12) {
        resetMobileSiderGesture();
        return;
      }

      if (gesture.mode === 'opening') {
        const nextTranslateX = Math.min(0, Math.max(-siderWidth, -siderWidth + Math.max(0, deltaX)));
        setMobileSiderTranslateX(nextTranslateX);
        return;
      }

      const nextTranslateX = Math.max(-siderWidth, Math.min(0, Math.min(0, deltaX)));
      setMobileSiderTranslateX(nextTranslateX);
    },
    [resetMobileSiderGesture, siderWidth]
  );

  const handleMobileSiderTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const gesture = mobileSiderGestureRef.current;
      if (!gesture) {
        return;
      }

      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - gesture.startX;
      const triggerDistance = Math.max(
        MOBILE_SIDER_GESTURE_MIN_DISTANCE,
        siderWidth * MOBILE_SIDER_GESTURE_TRIGGER_RATIO
      );

      if (gesture.mode === 'opening') {
        setCollapsed(deltaX >= triggerDistance ? false : true);
      } else {
        setCollapsed(deltaX <= -triggerDistance ? true : false);
      }

      resetMobileSiderGesture();
    },
    [resetMobileSiderGesture, siderWidth]
  );

  const handleMobileSiderTouchCancel = useCallback(() => {
    resetMobileSiderGesture();
  }, [resetMobileSiderGesture]);

  return (
    <LayoutContext.Provider
      value={{
        isMobile,
        siderCollapsed: collapsed,
        setSiderCollapsed: setCollapsed,
      }}
    >
      <div
        className={classNames(
          'app-shell relative flex flex-col size-full min-h-0',
          isMobile && `app-shell--mobile-${mobileTopChromeMode}`
        )}
        style={appShellStyle}
        onTouchStart={handleMobileSiderTouchStart}
        onTouchMove={handleMobileSiderTouchMove}
        onTouchEnd={handleMobileSiderTouchEnd}
        onTouchCancel={handleMobileSiderTouchCancel}
      >
        <Titlebar
          workspaceAvailable={workspaceAvailable}
          leftPaneWidth={collapsed ? desktopCollapsedSiderWidth : desktopExpandedSiderWidth}
        />
        {/* 移动端左侧边栏蒙板 / Mobile left sider backdrop */}
        {isMobile && showPrimarySider && (!collapsed || isDraggingMobileSider) && (
          <div
            className='fixed inset-0 bg-black/30 z-90'
            style={{
              opacity: mobileSiderOpenProgress,
              pointerEvents: collapsed ? 'none' : 'auto',
              transition: isDraggingMobileSider ? 'none' : 'opacity 0.22s ease',
            }}
            onClick={() => setCollapsed(true)}
            aria-hidden='true'
          />
        )}

        <ArcoLayout className={'size-full layout flex-1 min-h-0'}>
          {showPrimarySider ? (
            <ArcoLayout.Sider
              collapsedWidth={isMobile ? 0 : desktopCollapsedSiderWidth}
              collapsed={collapsed}
              width={desktopExpandedSiderWidth}
              className={classNames('!bg-2 layout-sider', {
                collapsed: collapsed,
              })}
              style={
                isMobile
                  ? {
                      position: 'fixed',
                      left: 0,
                      zIndex: 100,
                      transform: `translateX(${resolvedMobileSiderTranslateX}px)`,
                      transition: isDraggingMobileSider ? 'none' : 'transform 0.22s ease',
                      pointerEvents: collapsed && !isDraggingMobileSider ? 'none' : 'auto',
                      willChange: 'transform',
                    }
                  : undefined
              }
            >
              <ArcoLayout.Content className='layout-sider-content !flex !flex-1 !min-h-0 p-8px'>
                <div className='flex h-full min-h-0 min-w-0 w-full flex-1'>
                  <div className='min-h-0 min-w-0 flex-1 w-full'>
                    {React.isValidElement(sider)
                      ? React.cloneElement(sider, {
                          onSessionClick: () => {
                            cleanupSiderTooltips();
                            if (isMobile) setCollapsed(true);
                          },
                          collapsed,
                        } as any)
                      : sider}
                  </div>
                </div>
              </ArcoLayout.Content>
            </ArcoLayout.Sider>
          ) : null}

          <ArcoLayout.Content
            className={classNames(
              'bg-1 layout-content flex flex-col min-h-0',
              isMobile && `layout-content--mobile-${mobileTopChromeMode}`
            )}
            onClick={() => {
              if (isMobile && showPrimarySider && !collapsed) setCollapsed(true);
            }}
            style={
              isMobile
                ? {
                    width: '100%',
                  }
                : undefined
            }
          >
            <Outlet />
            {multiAgentContextHolder}
            {directorySelectionContextHolder}
            <PwaPullToRefresh />
            <Suspense fallback={null}>
              <UpdateModal />
            </Suspense>
          </ArcoLayout.Content>
        </ArcoLayout>
      </div>
    </LayoutContext.Provider>
  );
};

export default Layout;
