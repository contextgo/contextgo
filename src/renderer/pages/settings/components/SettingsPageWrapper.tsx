import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { SettingsViewModeProvider } from '@/renderer/components/settings/SettingsModal/settingsViewContext';
import { PreviewPanel, usePreviewContext } from '@/renderer/pages/conversation/Preview';
import { isElectronDesktop, resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import { extensions as extensionsIpc, type IExtensionSettingsTab } from '@/common/adapter/ipcBridge';
import {
  AlarmClock,
  Command,
  Communication,
  ConnectionPoint,
  Earth,
  Info,
  Puzzle,
  System,
  Toolkit,
} from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useExtI18n } from '@/renderer/hooks/system/useExtI18n';
import './settings.css';

const normalizeSettingsAnchor = (anchor: string): string => (anchor === 'display' ? 'system' : anchor);

interface SettingsPageWrapperProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

const SettingsPageWrapper: React.FC<SettingsPageWrapperProps> = ({ children, className, contentClassName }) => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const isDesktop = isElectronDesktop();
  const { isOpen: isPreviewOpen, activeTab } = usePreviewContext();

  const [extensionTabs, setExtensionTabs] = useState<IExtensionSettingsTab[]>([]);

  useEffect(() => {
    void extensionsIpc.getSettingsTabs
      .invoke()
      .then((tabs) => setExtensionTabs(tabs ?? []))
      .catch((err) => console.error('[SettingsPageWrapper] Failed to load extension tabs:', err));
  }, []);

  const { resolveExtTabName } = useExtI18n();

  type NavItem = { label: string; icon: React.ReactElement; path: string; id: string };

  const menuItems = React.useMemo(() => {
    const builtins: NavItem[] = [
      {
        id: 'cron',
        label: t('cron.scheduledTasks'),
        icon: <AlarmClock theme='outline' size='16' className='app-icon' />,
        path: 'cron',
      },
      {
        id: 'tools',
        label: t('settings.tools'),
        icon: <Toolkit theme='outline' size='16' className='app-icon' />,
        path: 'tools',
      },
      {
        id: 'commands',
        label: t('settings.commands.title'),
        icon: <Command theme='outline' size='16' className='app-icon' />,
        path: 'commands',
      },
      {
        id: 'webui',
        label: t('settings.webui'),
        icon: isDesktop ? (
          <Earth theme='outline' size='16' className='app-icon' />
        ) : (
          <Communication theme='outline' size='16' className='app-icon' />
        ),
        path: 'webui',
      },
      {
        id: 'channels',
        label: t('settings.agentEntry'),
        icon: <Communication theme='outline' size='16' className='app-icon' />,
        path: 'channels',
      },
      {
        id: 'activeSessions',
        label: t('settings.activeSessions'),
        icon: <ConnectionPoint theme='outline' size='16' className='app-icon' />,
        path: 'agent-publish',
      },
      {
        id: 'system',
        label: t('settings.system'),
        icon: <System theme='outline' size='16' className='app-icon' />,
        path: 'system',
      },
      {
        id: 'about',
        label: t('settings.about'),
        icon: <Info theme='outline' size='16' className='app-icon' />,
        path: 'about',
      },
    ];

    // Insert extension tabs before system (unanchored default) or at anchor position
    const result = [...builtins];
    const unanchored: IExtensionSettingsTab[] = [];
    const beforeMap = new Map<string, IExtensionSettingsTab[]>();
    const afterMap = new Map<string, IExtensionSettingsTab[]>();

    for (const tab of extensionTabs) {
      if (!tab.position) {
        unanchored.push(tab);
        continue;
      }
      const anchor = normalizeSettingsAnchor(tab.position.anchor);
      const map = tab.position.placement === 'before' ? beforeMap : afterMap;
      let list = map.get(anchor);
      if (!list) {
        list = [];
        map.set(anchor, list);
      }
      list.push(tab);
    }

    const toNavItem = (tab: IExtensionSettingsTab): NavItem => {
      const resolvedIcon = resolveExtensionAssetUrl(tab.icon) || tab.icon;
      return {
        id: tab.id,
        label: resolveExtTabName(tab),
        icon: resolvedIcon ? (
          <img src={resolvedIcon} alt='' className='h-16px w-16px object-contain' />
        ) : (
          <Puzzle theme='outline' size='16' className='app-icon' />
        ),
        path: `ext/${tab.id}`,
      };
    };

    for (let i = result.length - 1; i >= 0; i--) {
      const id = result[i].id;
      const afters = afterMap.get(id);
      if (afters) result.splice(i + 1, 0, ...afters.map(toNavItem));
      const befores = beforeMap.get(id);
      if (befores) result.splice(i, 0, ...befores.map(toNavItem));
    }

    if (unanchored.length > 0) {
      const sysIdx = result.findIndex((item) => item.id === 'system');
      const idx = sysIdx >= 0 ? sysIdx : result.length;
      result.splice(idx, 0, ...unanchored.map(toNavItem));
    }

    return result;
  }, [isDesktop, t, extensionTabs, resolveExtTabName]);

  const containerClass = classNames(
    'settings-page-wrapper secondary-page-frame w-full min-h-full box-border overflow-y-auto',
    className
  );

  const contentClass = classNames('settings-page-content secondary-page-inner mx-auto w-full md:max-w-[min(1440px,calc(100vw-144px))]', contentClassName);
  const showPreviewDock = !isMobile && isPreviewOpen && Boolean(activeTab);
  const previewDock =
    showPreviewDock && typeof document !== 'undefined'
      ? createPortal(
          <aside
            className='settings-page-preview-shell'
            data-testid='settings-page-preview'
            aria-label={t('preview.preview', { defaultValue: 'Preview' })}
          >
            <div className='settings-page-preview-panel'>
              <PreviewPanel />
            </div>
          </aside>,
          document.body
        )
      : null;

  return (
    <SettingsViewModeProvider value='page'>
      <div className={containerClass}>
        <div className='settings-page-shell'>
          <div className='settings-page-main'>
            {isMobile && (
              <div className='settings-mobile-top-nav'>
                {menuItems.map((item) => {
                  const active = pathname.includes(`/settings/${item.path}`);
                  return (
                    <button
                      key={item.path}
                      type='button'
                      className={classNames('settings-mobile-top-nav__item', {
                        'settings-mobile-top-nav__item--active': active,
                      })}
                      onClick={() => {
                        void navigate(`/settings/${item.path}`, { replace: true });
                      }}
                    >
                      <span className='settings-mobile-top-nav__icon app-icon-slot'>{item.icon}</span>
                      <span className='settings-mobile-top-nav__label'>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className={contentClass}>{children}</div>
          </div>
        </div>
      </div>
      {previewDock}
    </SettingsViewModeProvider>
  );
};

export default SettingsPageWrapper;
