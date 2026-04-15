import { Button } from '@arco-design/web-react';
import { copyText } from '@renderer/utils/ui/clipboard';
import AppLoader from '@renderer/components/layout/AppLoader';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { ConversationHistoryProvider } from '@renderer/hooks/context/ConversationHistoryContext';
import { useConversationTabs } from '@renderer/pages/conversation/hooks/ConversationTabsContext';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import {
  CONVERSATION_SEARCH_ROUTE,
  ConversationSearchPage,
} from '@renderer/pages/conversation/GroupedHistory/ConversationSearchPopover';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { isMobileShellWebView, isElectronDesktop } from '@renderer/utils/platform';
import {
  getLastStableHashRoute,
  normalizeHashRouteShellHref,
  rememberStableHashRoute,
  warmCriticalRendererRoutes,
} from './routerLocation';
import Layout from './Layout';
import Sider from './Sider';
import {
  OFFICIAL_REMOTE_DEVICES_ROUTE,
  resolveAuthenticatedStartupPath,
  shouldPreferOfficialRemoteShell,
} from '@renderer/utils/officialRemote';

type LazyRouteLoader = () => Promise<{ default: React.ComponentType }>;

const loadConversation = () => import('@renderer/pages/conversation');
const loadConnectorsPage = () => import('@renderer/pages/connectors');
const loadGuid = () => import('@renderer/pages/guid');
const loadGlobalScheduleSettings = () => import('@renderer/pages/schedule/GlobalScheduleSettings');
const loadRemoteDevicesPage = () => import('@renderer/pages/RemoteDevicesPage');
const loadAgentsPage = () => import('@renderer/pages/agents');
const loadAgentEntrySettings = () => import('@renderer/pages/settings/AgentSettings/AgentEntrySettings');
const loadHooksManagement = () => import('@renderer/pages/settings/AgentSettings/HooksManagement');
const loadSystemRunsPage = () => import('@renderer/pages/settings/AgentSettings/SystemRunsPage');
const loadSkillsHubSettings = () => import('@renderer/pages/settings/SkillsHubSettings');
const loadGeminiSettings = () => import('@renderer/pages/settings/GeminiSettings');
const loadModeSettings = () => import('@renderer/pages/settings/ModeSettings');
const loadSystemSettings = () => import('@renderer/pages/settings/SystemSettings');
const loadExtensionSettingsPage = () => import('@renderer/pages/settings/ExtensionSettingsPage');
const loadLoginPage = () => import('@renderer/pages/login');
const loadComponentsShowcase = () => import('@renderer/pages/TestShowcase');

const isRecoverableRouteError = (error: Error): boolean =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message
  );

const buildRouteErrorDetails = (routePath: string, error: Error): string =>
  [`route: ${routePath}`, `message: ${error.message}`, error.stack ? `stack:\n${error.stack}` : undefined]
    .filter(Boolean)
    .join('\n\n');

const getRouteErrorTypeLabel = (
  translate: (key: string, options?: { defaultValue?: string }) => string,
  recoverable: boolean
): string =>
  recoverable
    ? translate('common.rendererCrash.routeModuleValue', { defaultValue: 'route-module' })
    : translate('common.rendererCrash.routeRenderValue', { defaultValue: 'route-render' });

const LazyRouteRenderer: React.FC<{ loader: LazyRouteLoader; retryToken: number }> = ({ loader, retryToken }) => {
  const LazyComponent = useMemo(() => React.lazy(loader), [loader, retryToken]);
  const location = useLocation();

  useEffect(() => {
    rememberStableHashRoute(`${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search]);

  return (
    <Suspense fallback={<AppLoader />}>
      <LazyComponent />
    </Suspense>
  );
};

const RouteRecoveryFallback: React.FC<{
  error: Error;
  routePath: string;
  onRetry: () => void;
}> = ({ error, routePath, onRetry }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const diagnosticsText = useMemo(() => buildRouteErrorDetails(routePath, error), [error, routePath]);
  const recoverable = isRecoverableRouteError(error);
  const lastStableRoute = useMemo(() => getLastStableHashRoute(), []);
  const canReturnToStableRoute = Boolean(lastStableRoute && lastStableRoute !== routePath);

  useEffect(() => {
    setCopyStatus('idle');
  }, [diagnosticsText]);

  const copyLabel =
    copyStatus === 'success'
      ? t('common.copySuccess')
      : copyStatus === 'error'
        ? t('common.copyFailed')
        : t('common.copy');

  return (
    <div className='renderer-route-recovery'>
      <div className='renderer-route-recovery__card'>
        <div className='renderer-route-recovery__eyebrow'>{t('common.error')}</div>
        <h2 className='renderer-route-recovery__title'>{t('common.rendererCrash.routeRecoveryTitle')}</h2>
        <p className='renderer-route-recovery__description'>{t('common.rendererCrash.routeRecoveryDescription')}</p>
        {recoverable ? (
          <div className='renderer-route-recovery__hint'>{t('common.rendererCrash.dynamicImportHint')}</div>
        ) : null}

        <div className='renderer-route-recovery__meta'>
          <div className='renderer-route-recovery__meta-row'>
            <span>{t('common.rendererCrash.route')}</span>
            <strong>{routePath}</strong>
          </div>
          <div className='renderer-route-recovery__meta-row'>
            <span>{t('common.rendererCrash.type')}</span>
            <strong>{getRouteErrorTypeLabel(t, recoverable)}</strong>
          </div>
          {canReturnToStableRoute ? (
            <div className='renderer-route-recovery__meta-row'>
              <span>{t('common.rendererCrash.lastSafeRoute')}</span>
              <strong>{lastStableRoute}</strong>
            </div>
          ) : null}
        </div>

        <div className='renderer-route-recovery__actions'>
          <Button type='primary' onClick={onRetry}>
            {t('common.rendererCrash.retryView')}
          </Button>
          {canReturnToStableRoute ? (
            <Button
              type='outline'
              onClick={() => {
                void navigate(lastStableRoute);
              }}
            >
              {t('common.rendererCrash.backToLastSafeRoute')}
            </Button>
          ) : null}
          <Button
            type='outline'
            onClick={() => {
              void navigate('/guid');
            }}
          >
            {t('common.rendererCrash.openGuid')}
          </Button>
          <Button
            type='outline'
            onClick={() => {
              void navigate('/settings/system');
            }}
          >
            {t('common.rendererCrash.openSystemSettings')}
          </Button>
          <Button
            type='outline'
            onClick={() => {
              void copyText(diagnosticsText)
                .then(() => {
                  setCopyStatus('success');
                })
                .catch(() => {
                  setCopyStatus('error');
                });
            }}
          >
            {copyLabel}
          </Button>
        </div>

        <pre className='renderer-route-recovery__details'>{diagnosticsText}</pre>
      </div>
    </div>
  );
};

type RecoverableLazyRouteProps = {
  loader: LazyRouteLoader;
  routePath: string;
};

type RecoverableLazyRouteState = {
  error: Error | null;
  retryToken: number;
};

class RecoverableLazyRoute extends React.Component<RecoverableLazyRouteProps, RecoverableLazyRouteState> {
  public state: RecoverableLazyRouteState = {
    error: null,
    retryToken: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<RecoverableLazyRouteState> {
    return { error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[RecoverableLazyRoute] Route render failed:', this.props.routePath, error, errorInfo.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState(
      (current): RecoverableLazyRouteState => ({
        error: null,
        retryToken: current.retryToken + 1,
      })
    );
  };

  public override render(): React.ReactNode {
    if (this.state.error) {
      return (
        <RouteRecoveryFallback error={this.state.error} routePath={this.props.routePath} onRetry={this.handleRetry} />
      );
    }

    return <LazyRouteRenderer loader={this.props.loader} retryToken={this.state.retryToken} />;
  }
}

const withRouteFallback = (loader: LazyRouteLoader, routePath: string) => (
  <RecoverableLazyRoute key={routePath} loader={loader} routePath={routePath} />
);

const ProtectedLayout: React.FC<{
  status: ReturnType<typeof useAuth>['status'];
}> = ({ status }) => {
  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return (
    <ConversationHistoryProvider>
      <Layout sider={<Sider />} />
    </ConversationHistoryProvider>
  );
};

const StartupConversationRedirect: React.FC = () => {
  const { openTabs, activeTabId } = useConversationTabs();
  const startupPath = useMemo(() => {
    const preferOfficialRemoteShell =
      typeof window !== 'undefined' &&
      shouldPreferOfficialRemoteShell({
        currentHref: window.location.href,
        isDesktopRuntime: isElectronDesktop(),
        isMobileShellRuntime: isMobileShellWebView(),
      });

    return resolveAuthenticatedStartupPath({
      activeTabId,
      openTabIds: openTabs.map((tab) => tab.id),
      preferOfficialRemoteShell,
    });
  }, [activeTabId, openTabs]);

  return <Navigate to={startupPath} replace />;
};

const LegacyAgentSettingsRedirect: React.FC = () => {
  const location = useLocation();
  const nextPath = location.pathname.replace(/^\/settings\/agent/, '/agents') || '/agents';
  const nextTarget = `${nextPath}${location.search}${location.hash}`;
  return <Navigate to={nextTarget} replace />;
};

const RoutedPanels: React.FC<{
  status: ReturnType<typeof useAuth>['status'];
}> = ({ status }) => {
  return (
    <Routes>
      <Route
        path='/login'
        element={
          status === 'authenticated' ? <StartupConversationRedirect /> : withRouteFallback(loadLoginPage, '/login')
        }
      />
      <Route element={<ProtectedLayout status={status} />}>
        <Route index element={<StartupConversationRedirect />} />
        <Route path='/guid' element={withRouteFallback(loadGuid, '/guid')} />
        <Route
          path={OFFICIAL_REMOTE_DEVICES_ROUTE}
          element={withRouteFallback(loadRemoteDevicesPage, OFFICIAL_REMOTE_DEVICES_ROUTE)}
        />
        <Route path='/hooks' element={<Navigate to='/settings/hooks' replace />} />
        <Route path='/connectors' element={withRouteFallback(loadConnectorsPage, '/connectors')} />
        <Route
          path='/connectors/:connectorId'
          element={withRouteFallback(loadConnectorsPage, '/connectors/:connectorId')}
        />
        <Route path={CONVERSATION_SEARCH_ROUTE} element={<ConversationSearchPage />} />
        <Route path='/conversation/:id' element={withRouteFallback(loadConversation, '/conversation/:id')} />
        <Route path='/agents/*' element={withRouteFallback(loadAgentsPage, '/agents/*')} />
        <Route path='/skills-hub' element={withRouteFallback(loadSkillsHubSettings, '/skills-hub')} />
        <Route path='/settings/gemini' element={withRouteFallback(loadGeminiSettings, '/settings/gemini')} />
        <Route path='/settings/model' element={withRouteFallback(loadModeSettings, '/settings/model')} />
        <Route path='/settings/agent/*' element={<LegacyAgentSettingsRedirect />} />
        <Route path='/settings/hooks' element={withRouteFallback(loadHooksManagement, '/settings/hooks')} />
        <Route
          path='/settings/schedule'
          element={withRouteFallback(loadGlobalScheduleSettings, '/settings/schedule')}
        />
        <Route path='/settings/skills-hub' element={withRouteFallback(loadSkillsHubSettings, '/settings/skills-hub')} />
        <Route path='/settings/display' element={<Navigate to='/settings/system' replace />} />
        <Route path='/settings/webui' element={<Navigate to='/settings/system' replace />} />
        <Route path='/settings/runtime' element={withRouteFallback(loadAgentEntrySettings, '/settings/runtime')} />
        <Route path='/settings/channels' element={withRouteFallback(loadAgentEntrySettings, '/settings/channels')} />
        <Route
          path='/settings/agent-publish'
          element={withRouteFallback(loadAgentEntrySettings, '/settings/agent-publish')}
        />
        <Route path='/settings/active-sessions' element={<Navigate to='/settings/agent-publish' replace />} />
        <Route
          path='/settings/agent-entry'
          element={withRouteFallback(loadAgentEntrySettings, '/settings/agent-entry')}
        />
        <Route path='/settings/system-runs' element={withRouteFallback(loadSystemRunsPage, '/settings/system-runs')} />
        <Route path='/settings/system' element={withRouteFallback(loadSystemSettings, '/settings/system')} />
        <Route path='/settings/about' element={withRouteFallback(loadSystemSettings, '/settings/about')} />
        <Route path='/settings/commands' element={<Navigate to='/settings/system' replace />} />
        <Route
          path='/settings/ext/:tabId'
          element={withRouteFallback(loadExtensionSettingsPage, '/settings/ext/:tabId')}
        />
        <Route path='/settings' element={<Navigate to='/settings/system' replace />} />
        <Route path='/test/components' element={withRouteFallback(loadComponentsShowcase, '/test/components')} />
      </Route>
      <Route
        path='*'
        element={status === 'authenticated' ? <StartupConversationRedirect /> : <Navigate to='/login' replace />}
      />
    </Routes>
  );
};

const PanelRoute: React.FC = () => {
  const { status } = useAuth();

  React.useEffect(() => {
    if (status !== 'authenticated' || typeof window === 'undefined') {
      return;
    }

    const nextHref = normalizeHashRouteShellHref(window.location.href);
    if (nextHref === window.location.href) {
      return;
    }

    window.history.replaceState(window.history.state, '', nextHref);
  }, [status]);

  React.useEffect(() => {
    warmCriticalRendererRoutes();
  }, []);

  return (
    <HashRouter>
      <RoutedPanels status={status} />
    </HashRouter>
  );
};

export default PanelRoute;
