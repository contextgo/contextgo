import { isElectronDesktop, resolveExtensionAssetUrl } from '@/renderer/utils/platform';
import { extensions as extensionsIpc, type IExtensionSettingsTab } from '@/common/adapter/ipcBridge';
import { useExtI18n } from '@/renderer/hooks/system/useExtI18n';
import {
  AlarmClock,
  Command,
  Communication,
  ConnectionPoint,
  Info,
  Robot,
  LinkCloud,
  Puzzle,
  System,
  Terminal,
} from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Tooltip } from '@arco-design/web-react';
import { getSiderTooltipProps } from '@/renderer/utils/ui/siderTooltip';
import { matchesSettingsNavPath, normalizeSettingsAnchor } from './settingsNavigation';

/** Builtin settings tab IDs in display order (must match router paths). */
const BUILTIN_TAB_IDS = [
  'schedule',
  'runtime',
  'commands',
  'webui',
  'channels',
  'activeSessions',
  'systemRuns',
  'system',
  'about',
] as const;

type SiderItem = {
  id: string;
  label: string;
  icon: React.ReactElement;
  isImageIcon?: boolean;
  /** Route path segment — for builtins: `/settings/{path}`, for extensions: `/settings/ext/{id}` */
  path: string;
};

const SettingsSider: React.FC<{ collapsed?: boolean; tooltipEnabled?: boolean }> = ({
  collapsed = false,
  tooltipEnabled = false,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [extensionTabs, setExtensionTabs] = useState<IExtensionSettingsTab[]>([]);
  const { resolveExtTabName } = useExtI18n();

  const loadExtensionTabs = useCallback(async (): Promise<IExtensionSettingsTab[]> => {
    const maxAttempts = 20;
    const retryDelayCapMs = 300;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const tabs = (await extensionsIpc.getSettingsTabs.invoke()) ?? [];
        if (tabs.length > 0 || attempt === maxAttempts - 1) {
          return tabs;
        }
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, Math.min(100 * (attempt + 1), retryDelayCapMs)));
    }

    if (lastError) {
      throw lastError;
    }

    return [];
  }, []);

  useEffect(() => {
    let disposed = false;

    const syncExtensionTabs = async () => {
      try {
        const tabs = await loadExtensionTabs();
        if (!disposed) {
          setExtensionTabs(tabs);
        }
      } catch (err) {
        if (!disposed) {
          console.error('[SettingsSider] Failed to load extension settings tabs:', err);
        }
      }
    };

    void syncExtensionTabs();
    const unsubscribe = extensionsIpc.stateChanged.on(() => {
      void syncExtensionTabs();
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [loadExtensionTabs]);

  const menus: SiderItem[] = useMemo(() => {
    // Build builtin items
    const builtinMap: Record<string, SiderItem> = {
      schedule: {
        id: 'schedule',
        label: t('schedule.scheduledTasks'),
        icon: <AlarmClock />,
        path: 'schedule',
      },
      runtime: {
        id: 'runtime',
        label: t('settings.runtimeManager.title', { defaultValue: 'Runtime' }),
        icon: <Terminal />,
        path: 'runtime',
      },
      commands: { id: 'commands', label: t('settings.commands.title'), icon: <Command />, path: 'commands' },
      webui: {
        id: 'webui',
        label: t('settings.webui'),
        icon: <LinkCloud />,
        path: 'webui',
      },
      channels: {
        id: 'channels',
        label: t('settings.agentEntry'),
        icon: <Communication />,
        path: 'channels',
      },
      activeSessions: {
        id: 'activeSessions',
        label: t('settings.activeSessions'),
        icon: <ConnectionPoint />,
        path: 'agent-publish',
      },
      systemRuns: {
        id: 'systemRuns',
        label: t('settings.systemRuns'),
        icon: <Robot />,
        path: 'system-runs',
      },
      system: { id: 'system', label: t('settings.system'), icon: <System />, path: 'system' },
      about: { id: 'about', label: t('settings.about'), icon: <Info />, path: 'about' },
    };

    // Start with ordered builtin IDs
    const result: SiderItem[] = BUILTIN_TAB_IDS.map((id) => builtinMap[id]);

    // Extension tabs with position anchoring
    const beforeMap = new Map<string, IExtensionSettingsTab[]>();
    const afterMap = new Map<string, IExtensionSettingsTab[]>();
    const unanchored: IExtensionSettingsTab[] = [];

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

    // Helper to create SiderItem from extension tab
    const toSiderItem = (tab: IExtensionSettingsTab): SiderItem => {
      const resolvedIcon = resolveExtensionAssetUrl(tab.icon) || tab.icon;
      return {
        id: tab.id,
        label: resolveExtTabName(tab),
        icon: resolvedIcon ? <img src={resolvedIcon} alt='' className='w-full h-full object-contain' /> : <Puzzle />,
        isImageIcon: Boolean(resolvedIcon),
        path: `ext/${tab.id}`,
      };
    };

    // Insert anchored tabs (reverse iteration to preserve indices)
    for (let i = result.length - 1; i >= 0; i--) {
      const builtinId = result[i].id;
      const afters = afterMap.get(builtinId);
      if (afters) {
        result.splice(i + 1, 0, ...afters.map(toSiderItem));
      }
      const befores = beforeMap.get(builtinId);
      if (befores) {
        result.splice(i, 0, ...befores.map(toSiderItem));
      }
    }

    // Append unanchored before "system"
    if (unanchored.length > 0) {
      const systemIdx = result.findIndex((item) => item.id === 'system');
      const insertIdx = systemIdx >= 0 ? systemIdx : result.length;
      result.splice(insertIdx, 0, ...unanchored.map(toSiderItem));
    }

    return result;
  }, [t, extensionTabs, resolveExtTabName]);

  const siderTooltipProps = getSiderTooltipProps(tooltipEnabled);
  return (
    <div
      className={classNames(
        'flex-1 min-h-0 w-full min-w-0 box-border settings-sider flex flex-col items-stretch gap-2px overflow-y-auto overflow-x-hidden',
        {
          'settings-sider--collapsed': collapsed,
        }
      )}
    >
      {menus.map((item) => {
        const isSelected = matchesSettingsNavPath(pathname, item.path);
        const itemNode = (
          <div
            data-settings-id={item.id}
            data-settings-path={item.path}
            className={classNames(
              'settings-sider__item w-full min-w-0 self-stretch box-border hover:bg-aou-1 px-12px py-8px rd-8px flex justify-start items-center gap-10px group cursor-pointer relative overflow-hidden group shrink-0 conversation-item [&.conversation-item+&.conversation-item]:mt-2px',
              {
                '!bg-aou-2 ': isSelected,
                '!px-0 !gap-0 justify-center': collapsed,
              }
            )}
            onClick={() => {
              Promise.resolve(navigate(`/settings/${item.path}`, { replace: true })).catch((error) => {
                console.error('Navigation failed:', error);
              });
            }}
          >
            {item.isImageIcon ? (
              <div
                className={classNames('inline-flex h-20px w-20px shrink-0 items-center justify-center leading-none', {
                  '!m-0': collapsed,
                })}
              >
                {item.icon}
              </div>
            ) : (
              <span className='inline-flex h-20px w-20px shrink-0 items-center justify-center leading-none'>
                {React.cloneElement(
                  item.icon as React.ReactElement<{
                    theme?: string;
                    size?: string | number;
                    className?: string;
                    strokeWidth?: number;
                  }>,
                  {
                    theme: 'outline',
                    size: '20',
                    strokeWidth: 3,
                    className: 'block text-t-secondary leading-none',
                  }
                )}
              </span>
            )}
            <div className='flex h-24px min-w-0 flex-1 items-center'>
              <div className='settings-sider__item-label inline-block w-full overflow-hidden text-nowrap whitespace-nowrap text-14px lh-24px text-t-primary'>
                {item.label}
              </div>
            </div>
          </div>
        );

        if (!tooltipEnabled) {
          return <React.Fragment key={item.id}>{itemNode}</React.Fragment>;
        }

        return (
          <Tooltip key={item.id} {...siderTooltipProps} content={item.label} position='right'>
            {itemNode}
          </Tooltip>
        );
      })}
    </div>
  );
};

export default SettingsSider;
