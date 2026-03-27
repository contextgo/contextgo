import React, { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLoader from '@renderer/components/layout/AppLoader';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import {
  CONVERSATION_SEARCH_ROUTE,
  ConversationSearchPage,
} from '@renderer/pages/conversation/GroupedHistory/ConversationSearchPopover';
import { useConversationTabs } from '@renderer/pages/conversation/hooks/ConversationTabsContext';
const Conversation = React.lazy(() => import('@renderer/pages/conversation'));
const Guid = React.lazy(() => import('@renderer/pages/guid'));
const GlobalCronSettings = React.lazy(() => import('@renderer/pages/cron/GlobalCronSettings'));
const AgentSettings = React.lazy(() => import('@renderer/pages/settings/AgentSettings'));
const HooksManagement = React.lazy(() => import('@renderer/pages/settings/AgentSettings/HooksManagement'));
const SkillsHubSettings = React.lazy(() => import('@renderer/pages/settings/SkillsHubSettings'));
const DisplaySettings = React.lazy(() => import('@renderer/pages/settings/DisplaySettings'));
const GeminiSettings = React.lazy(() => import('@renderer/pages/settings/GeminiSettings'));
const ModeSettings = React.lazy(() => import('@renderer/pages/settings/ModeSettings'));
const SystemSettings = React.lazy(() => import('@renderer/pages/settings/SystemSettings'));
const ToolsSettings = React.lazy(() => import('@renderer/pages/settings/ToolsSettings'));
const WebuiSettings = React.lazy(() => import('@renderer/pages/settings/WebuiSettings'));
const ExtensionSettingsPage = React.lazy(() => import('@renderer/pages/settings/ExtensionSettingsPage'));
const LoginPage = React.lazy(() => import('@renderer/pages/login'));
const ComponentsShowcase = React.lazy(() => import('@renderer/pages/TestShowcase'));

const withRouteFallback = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<AppLoader />}>
    <Component />
  </Suspense>
);

const ProtectedLayout: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return React.cloneElement(layout);
};

const StartupConversationRedirect: React.FC = () => {
  const { openTabs, activeTabId } = useConversationTabs();
  const hasPersistedActiveTab = Boolean(activeTabId && openTabs.some((tab) => tab.id === activeTabId));

  if (hasPersistedActiveTab && activeTabId) {
    return <Navigate to={`/conversation/${activeTabId}`} replace />;
  }

  return <Navigate to='/guid' replace />;
};

const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route
          path='/login'
          element={status === 'authenticated' ? <StartupConversationRedirect /> : withRouteFallback(LoginPage)}
        />
        <Route element={<ProtectedLayout layout={layout} />}>
          <Route index element={<StartupConversationRedirect />} />
          <Route path='/guid' element={withRouteFallback(Guid)} />
          <Route path={CONVERSATION_SEARCH_ROUTE} element={<ConversationSearchPage />} />
          <Route path='/conversation/:id' element={withRouteFallback(Conversation)} />
          <Route path='/agents' element={withRouteFallback(AgentSettings)} />
          <Route path='/skills-hub' element={withRouteFallback(SkillsHubSettings)} />
          <Route path='/settings/gemini' element={withRouteFallback(GeminiSettings)} />
          <Route path='/settings/model' element={withRouteFallback(ModeSettings)} />
          <Route path='/settings/agent' element={withRouteFallback(AgentSettings)} />
          <Route path='/settings/hooks' element={withRouteFallback(HooksManagement)} />
          <Route path='/settings/cron' element={withRouteFallback(GlobalCronSettings)} />
          <Route path='/settings/skills-hub' element={withRouteFallback(SkillsHubSettings)} />
          <Route path='/settings/display' element={withRouteFallback(DisplaySettings)} />
          <Route path='/settings/webui' element={withRouteFallback(WebuiSettings)} />
          <Route path='/settings/system' element={withRouteFallback(SystemSettings)} />
          <Route path='/settings/about' element={withRouteFallback(SystemSettings)} />
          <Route path='/settings/tools' element={withRouteFallback(ToolsSettings)} />
          <Route path='/settings/ext/:tabId' element={withRouteFallback(ExtensionSettingsPage)} />
          <Route path='/settings' element={<Navigate to='/settings/system' replace />} />
          <Route path='/test/components' element={withRouteFallback(ComponentsShowcase)} />
        </Route>
        <Route
          path='*'
          element={status === 'authenticated' ? <StartupConversationRedirect /> : <Navigate to='/login' replace />}
        />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;
