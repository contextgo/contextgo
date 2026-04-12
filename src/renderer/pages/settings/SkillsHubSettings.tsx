import { ipcBridge } from '@/common';
import { SettingsSubModal } from '@/renderer/components/settings';
import type {
  SkillInfo,
  SkillMarketBundle,
  SkillMarketIndustry,
  SkillMarketItem,
  SkillMarketStats,
  SkillMarketView,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import { Button, Message, Typography, Input, Dropdown, Menu } from '@arco-design/web-react';
import { Delete, FolderOpen, Info, Search, Plus, Refresh } from '@icon-park/react';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsPageWrapper from './components/SettingsPageWrapper';

// 外部来源类型 / External source type
interface ExternalSource {
  name: string;
  path: string;
  source: string;
  skills: Array<{ name: string; description: string; path: string }>;
}

const getAvatarColorClass = (name: string) => {
  if (!name) return 'bg-[#165DFF] text-white';
  const colors = [
    'bg-[#165DFF] text-white', // Blue
    'bg-[#00B42A] text-white', // Green
    'bg-[#722ED1] text-white', // Purple
    'bg-[#F5319D] text-white', // Pink
    'bg-[#F77234] text-white', // Orange
    'bg-[#14C9C9] text-white', // Cyan
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const SkillsHubSettings: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [skillPaths, setSkillPaths] = useState<{ userSkillsDir: string; builtinSkillsDir: string } | null>(null);
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
  const [activeSourceTab, setActiveSourceTab] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchExternalQuery, setSearchExternalQuery] = useState('');
  const [marketQuery, setMarketQuery] = useState('');
  const [marketSkills, setMarketSkills] = useState<SkillMarketItem[]>([]);
  const [marketView, setMarketView] = useState<SkillMarketView>('curated');
  const [marketIndustryId, setMarketIndustryId] = useState('all');
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [marketBrandName, setMarketBrandName] = useState('ContextGo');
  const [marketTotal, setMarketTotal] = useState(0);
  const [marketTotalAvailable, setMarketTotalAvailable] = useState(0);
  const [marketSiteUrl, setMarketSiteUrl] = useState('https://www.skillmarket.com.cn');
  const [marketStats, setMarketStats] = useState<SkillMarketStats | null>(null);
  const [marketIndustries, setMarketIndustries] = useState<SkillMarketIndustry[]>([]);
  const [marketBundles, setMarketBundles] = useState<SkillMarketBundle[]>([]);
  const [marketInstallingId, setMarketInstallingId] = useState<string | null>(null);
  const [showAddPathModal, setShowAddPathModal] = useState(false);
  const [customPathName, setCustomPathName] = useState('');
  const [customPathValue, setCustomPathValue] = useState('');
  const [deleteSkillName, setDeleteSkillName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return availableSkills;
    const lowerQuery = searchQuery.toLowerCase();
    return availableSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) || (s.description && s.description.toLowerCase().includes(lowerQuery))
    );
  }, [availableSkills, searchQuery]);

  const renderSkillDependencyTags = useCallback(
    (skill: SkillInfo) => {
      if (!skill.dependencyHints || skill.dependencyHints.length === 0) {
        return null;
      }

      return (
        <div className='mt-6px flex flex-wrap gap-6px'>
          {skill.dependencyHints.map((hint) => {
            const toneClass =
              hint.status === 'ready'
                ? 'bg-[rgba(var(--green-6),0.08)] text-green-6 border border-[rgba(var(--green-6),0.2)]'
                : hint.status === 'missing'
                  ? 'bg-[rgba(var(--red-6),0.08)] text-red-6 border border-[rgba(var(--red-6),0.2)]'
                  : hint.kind === 'mcp'
                    ? 'bg-[rgba(var(--blue-6),0.08)] text-blue-6 border border-[rgba(var(--blue-6),0.2)]'
                    : 'bg-fill-2 text-t-secondary border border-border-1';
            const labelPrefix =
              hint.kind === 'env'
                ? hint.status === 'missing'
                  ? t('settings.skillDependencyEnvMissing', { defaultValue: 'Env Missing' })
                  : t('settings.skillDependencyEnvReady', { defaultValue: 'Env Ready' })
                : hint.kind === 'command'
                  ? hint.status === 'missing'
                    ? t('settings.skillDependencyCommandMissing', { defaultValue: 'Command Missing' })
                    : t('settings.skillDependencyCommandReady', { defaultValue: 'Command Ready' })
                  : hint.kind === 'mcp'
                    ? t('settings.skillDependencyCodexTool', { defaultValue: 'Codex Tool' })
                    : t('settings.skillDependencyCompatibility', { defaultValue: 'Compatibility' });

            return (
              <span
                key={`${hint.source}:${hint.kind}:${hint.label}`}
                className={`text-11px px-6px py-1px rd-4px font-medium ${toneClass}`}
                title={hint.detail || hint.label}
              >
                {`${labelPrefix}: ${hint.label}`}
              </span>
            );
          })}
        </div>
      );
    },
    [t]
  );

  const renderSkillCompatibilityNotes = useCallback((skill: SkillInfo) => {
    if (!skill.compatibility || skill.compatibility.length === 0) {
      return null;
    }

    return (
      <div className='mt-6px flex flex-col gap-4px'>
        {skill.compatibility.slice(0, 2).map((note) => (
          <div key={note} className='text-11px leading-relaxed text-t-tertiary' title={note}>
            {note}
          </div>
        ))}
      </div>
    );
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const skills = await ipcBridge.fs.listAvailableSkills.invoke();
      setAvailableSkills(skills);

      const external = await ipcBridge.fs.detectAndCountExternalSkills.invoke();
      if (external.success && external.data) {
        setExternalSources(external.data);
        if (external.data.length > 0 && !activeSourceTab) {
          setActiveSourceTab(external.data[0].source);
        }
      }

      const paths = await ipcBridge.fs.getSkillPaths.invoke();
      setSkillPaths(paths);
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      Message.error(t('settings.skillsHub.fetchError', { defaultValue: 'Failed to fetch skills' }));
    } finally {
      setLoading(false);
    }
  }, [t, activeSourceTab]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const loadSkillMarket = useCallback(
    async ({
      append = false,
      forceRefresh = false,
      nextQuery,
      nextView,
      nextIndustryId,
      nextOffset,
    }: {
      append?: boolean;
      forceRefresh?: boolean;
      nextQuery?: string;
      nextView?: SkillMarketView;
      nextIndustryId?: string;
      nextOffset?: number;
    } = {}) => {
      const query = nextQuery ?? marketQuery;
      const view = nextView ?? marketView;
      const industryId = nextIndustryId ?? marketIndustryId;
      const offset = nextOffset ?? 0;

      if (append) {
        setMarketLoadingMore(true);
      } else if (forceRefresh) {
        setMarketRefreshing(true);
      } else {
        setMarketLoading(true);
      }

      try {
        const response = await ipcBridge.fs.searchSkillMarket.invoke({
          query,
          limit: 24,
          offset,
          forceRefresh,
          view,
          industryId: industryId === 'all' ? undefined : industryId,
        });

        if (!response.success || !response.data) {
          Message.error(
            response.msg ||
              t('settings.skillsHub.marketFetchFailed', {
                defaultValue: 'Failed to load Skill Market',
              })
          );
          return;
        }

        setMarketSkills((current) => (append ? [...current, ...response.data.items] : response.data.items));
        setMarketBrandName(response.data.brandName);
        setMarketTotal(response.data.total);
        setMarketTotalAvailable(response.data.totalAvailable);
        setMarketSiteUrl(response.data.siteUrl);
        setMarketStats(response.data.stats);
        setMarketIndustries(response.data.industryIndex);
        setMarketBundles(response.data.bundles);
      } catch (error) {
        console.error('Failed to load Skill Market:', error);
        Message.error(
          t('settings.skillsHub.marketFetchFailed', {
            defaultValue: 'Failed to load Skill Market',
          })
        );
      } finally {
        setMarketLoading(false);
        setMarketLoadingMore(false);
        setMarketRefreshing(false);
      }
    },
    [marketIndustryId, marketQuery, marketView, t]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSkillMarket({ nextQuery: marketQuery });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [marketIndustryId, marketQuery, marketView, loadSkillMarket]);

  const handleImport = async (skillPath: string) => {
    try {
      const result = await ipcBridge.fs.importSkillWithSymlink.invoke({ skillPath });
      if (result.success) {
        Message.success(
          result.msg || t('settings.skillsHub.importSuccess', { defaultValue: 'Skill imported successfully' })
        );
        void fetchData();
      } else {
        Message.error(result.msg || t('settings.skillsHub.importFailed', { defaultValue: 'Failed to import skill' }));
      }
    } catch (error) {
      console.error('Failed to import skill:', error);
      Message.error(t('settings.skillsHub.importError', { defaultValue: 'Error importing skill' }));
    }
  };

  const handleInstallMarketSkill = useCallback(
    async (skill: SkillMarketItem) => {
      if (skill.archives.length === 0) {
        Message.error(
          t('settings.skillsHub.marketArchiveUnavailable', {
            name: skill.name,
            defaultValue: 'No downloadable package is available for "{{name}}"',
          })
        );
        return;
      }

      setMarketInstallingId(skill.id);
      try {
        const result = await ipcBridge.fs.installSkillMarketSkill.invoke({
          skillId: skill.id,
          archive: skill.archives[0],
        });

        if (result.success) {
          Message.success(
            t('settings.skillsHub.marketInstallSuccess', {
              name: skill.displayName || skill.name,
              defaultValue: 'Installed "{{name}}"',
            })
          );
          await fetchData();
        } else {
          Message.error(
            result.msg ||
              t('settings.skillsHub.marketInstallFailed', {
                name: skill.displayName || skill.name,
                defaultValue: 'Failed to install "{{name}}" from Skill Market',
              })
          );
        }
      } catch (error) {
        console.error('Failed to install Skill Market skill:', error);
        Message.error(
          t('settings.skillsHub.marketInstallFailed', {
            name: skill.displayName || skill.name,
            defaultValue: 'Failed to install "{{name}}" from Skill Market',
          })
        );
      } finally {
        setMarketInstallingId(null);
      }
    },
    [fetchData, t]
  );

  const handleInstallMarketBundle = useCallback(
    async (bundle: SkillMarketBundle) => {
      const alreadyInstalled = new Set(availableSkills.map((skill) => skill.name));
      const installableSkills = bundle.skills.filter(
        (skill) => skill.archives.length > 0 && !alreadyInstalled.has(skill.name)
      );

      if (installableSkills.length === 0) {
        Message.warning(
          t('settings.skillsHub.marketBundleNoInstallableSkills', {
            defaultValue: 'All skills in this bundle are already installed or unavailable',
          })
        );
        return;
      }

      setMarketInstallingId(`bundle:${bundle.id}`);
      try {
        const installResults = await Promise.all(
          installableSkills.map(async (skill) => ({
            skill,
            result: await ipcBridge.fs.installSkillMarketSkill.invoke({
              skillId: skill.id,
              archive: skill.archives[0],
            }),
          }))
        );
        const failedResult = installResults.find(({ result }) => !result.success);

        if (failedResult) {
          throw new Error(
            failedResult.result.msg ||
              t('settings.skillsHub.marketInstallFailed', {
                name: failedResult.skill.displayName || failedResult.skill.name,
                defaultValue: 'Failed to install "{{name}}" from Skill Market',
              })
          );
        }

        Message.success(
          t('settings.skillsHub.marketBundleInstallSuccess', {
            name: bundle.title,
            count: installableSkills.length,
            defaultValue: 'Installed {{count}} skills from "{{name}}"',
          })
        );
        await fetchData();
      } catch (error) {
        console.error('Failed to install Skill Market bundle:', error);
        Message.error(
          error instanceof Error
            ? error.message
            : t('settings.skillsHub.marketBundleInstallFailed', {
                name: bundle.title,
                defaultValue: 'Failed to install bundle "{{name}}"',
              })
        );
      } finally {
        setMarketInstallingId(null);
      }
    },
    [availableSkills, fetchData, t]
  );

  const handleImportAll = async (skills: Array<{ name: string; path: string }>) => {
    const importResults = await Promise.allSettled(
      skills.map((skill) => ipcBridge.fs.importSkillWithSymlink.invoke({ skillPath: skill.path }))
    );
    const successCount = importResults.filter((result) => result.status === 'fulfilled' && result.value.success).length;

    if (successCount > 0) {
      Message.success(
        t('settings.skillsHub.importAllSuccess', {
          count: successCount,
          defaultValue: `${successCount} skills imported`,
        })
      );
      void fetchData();
    }
  };

  const handleDelete = async (skillName: string) => {
    try {
      const result = await ipcBridge.fs.deleteSkill.invoke({ skillName });
      if (result.success) {
        Message.success(result.msg || t('settings.skillsHub.deleteSuccess', { defaultValue: 'Skill deleted' }));
        void fetchData();
      } else {
        Message.error(result.msg || t('settings.skillsHub.deleteFailed', { defaultValue: 'Failed to delete skill' }));
      }
    } catch (error) {
      console.error('Failed to delete skill:', error);
      Message.error(t('settings.skillsHub.deleteError', { defaultValue: 'Error deleting skill' }));
    }
  };

  const handleManualImport = async () => {
    try {
      const result = await ipcBridge.dialog.showOpen.invoke({
        properties: ['openDirectory'],
      });
      if (result && result.length > 0) {
        await handleImport(result[0]);
      }
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
    }
  };

  const handleRefreshExternal = useCallback(async () => {
    setRefreshing(true);
    try {
      const external = await ipcBridge.fs.detectAndCountExternalSkills.invoke();
      if (external.success && external.data) {
        setExternalSources(external.data);
        if (external.data.length > 0 && !external.data.find((s) => s.source === activeSourceTab)) {
          setActiveSourceTab(external.data[0].source);
        }
      }
      Message.success(t('common.refreshSuccess', { defaultValue: 'Refreshed' }));
    } catch (error) {
      console.error('Failed to refresh external skills:', error);
    } finally {
      setRefreshing(false);
    }
  }, [t, activeSourceTab]);

  const handleAddCustomPath = useCallback(async () => {
    if (!customPathName.trim() || !customPathValue.trim()) return;
    try {
      const result = await ipcBridge.fs.addCustomExternalPath.invoke({
        name: customPathName.trim(),
        path: customPathValue.trim(),
      });
      if (result.success) {
        setShowAddPathModal(false);
        setCustomPathName('');
        setCustomPathValue('');
        void handleRefreshExternal();
      } else {
        Message.error(
          result.msg ||
            t('settings.skillsHub.addPathFailed', {
              defaultValue: 'Failed to add path',
            })
        );
      }
    } catch {
      Message.error(
        t('settings.skillsHub.addCustomPathFailed', {
          defaultValue: 'Failed to add custom path',
        })
      );
    }
  }, [customPathName, customPathValue, handleRefreshExternal, t]);

  const totalExternal = externalSources.reduce((sum, src) => sum + src.skills.length, 0);
  const activeSource = externalSources.find((s) => s.source === activeSourceTab);
  const hasMoreMarketSkills = marketSkills.length < marketTotal;

  const filteredExternalSkills = useMemo(() => {
    if (!activeSource) return [];
    if (!searchExternalQuery.trim()) return activeSource.skills;
    const lowerQuery = searchExternalQuery.toLowerCase();
    return activeSource.skills.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) || (s.description && s.description.toLowerCase().includes(lowerQuery))
    );
  }, [activeSource, searchExternalQuery]);

  return (
    <>
      <SettingsPageWrapper>
        <div className='flex flex-col h-full w-full'>
          <div className='space-y-16px pb-24px'>
            <div className='relative overflow-hidden border border-b-base bg-base px-[16px] py-32px shadow-sm rd-16px md:px-[32px] md:rd-24px transition-all'>
              <div className='relative z-10 flex flex-col gap-16px'>
                <div className='flex flex-col gap-16px xl:flex-row xl:items-start xl:justify-between'>
                  <div className='flex flex-1 flex-col gap-10px'>
                    <div className='flex flex-wrap items-center gap-10px'>
                      <span className='text-16px font-bold tracking-tight text-t-primary md:text-18px'>
                        {t('settings.skillsHub.marketTitle', { defaultValue: 'Skill Market' })}
                      </span>
                      <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 text-12px px-10px py-2px rd-[100px] font-medium'>
                        {marketTotalAvailable}
                      </span>
                      <span className='rounded-[100px] bg-fill-2 px-8px py-2px text-11px text-t-secondary'>
                        {t('settings.skillsHub.marketCatalogTitle', {
                          brand: marketBrandName,
                          defaultValue: '{{brand}} curated catalog',
                        })}
                      </span>
                    </div>
                    <Typography.Text className='max-w-2xl text-13px leading-relaxed text-t-secondary'>
                      {t('settings.skillsHub.marketDescription', {
                        defaultValue:
                          'Search the remote catalog, install skills into your local library, and reuse them across assistants.',
                      })}
                    </Typography.Text>
                  </div>

                  <div className='flex flex-col gap-12px xl:min-w-[360px]'>
                    <Input
                      prefix={<Search />}
                      placeholder={t('settings.skillsHub.marketSearchPlaceholder', {
                        defaultValue: 'Search Skill Market...',
                      })}
                      value={marketQuery}
                      onChange={(value) => setMarketQuery(value)}
                      className='bg-transparent [&_.arco-input-wrapper]:rd-16px [&_.arco-input-wrapper]:border [&_.arco-input-wrapper]:border-solid [&_.arco-input-wrapper]:border-[color:color-mix(in_srgb,var(--border-base)_78%,transparent)] [&_.arco-input-wrapper]:bg-[color:color-mix(in_srgb,var(--bg-1)_92%,var(--fill-1)_8%)] [&_.arco-input-wrapper]:px-2px [&_.arco-input-wrapper]:shadow-[inset_0_1px_0_color-mix(in_srgb,white_18%,transparent),0_10px_24px_color-mix(in_srgb,rgb(15_23_42)_7%,transparent)] [&_.arco-input-wrapper]:transition-all [&_.arco-input-wrapper:hover]:border-[color:color-mix(in_srgb,rgb(var(--primary-6))_28%,var(--border-base))] [&_.arco-input-wrapper:hover]:bg-[color:color-mix(in_srgb,var(--bg-1)_96%,var(--fill-1)_4%)] [&_.arco-input-wrapper:hover]:shadow-[inset_0_1px_0_color-mix(in_srgb,white_18%,transparent),0_12px_28px_color-mix(in_srgb,rgb(15_23_42)_9%,transparent)] [&_.arco-input-wrapper:focus-within]:border-[color:color-mix(in_srgb,rgb(var(--primary-6))_42%,var(--border-base))] [&_.arco-input-wrapper:focus-within]:bg-base [&_.arco-input-wrapper:focus-within]:shadow-[inset_0_1px_0_color-mix(in_srgb,white_18%,transparent),0_14px_30px_color-mix(in_srgb,rgb(var(--primary-6))_12%,transparent)] [&_.arco-input]:bg-transparent [&_.arco-input]:py-8px [&_.arco-input]:text-13px [&_.arco-input::placeholder]:text-t-tertiary [&_.arco-input-group-prefix]:pl-10px [&_.arco-input-group-prefix]:text-t-tertiary [&_.arco-input-group-prefix]:transition-colors [&_.arco-input-wrapper:focus-within_.arco-input-group-prefix]:text-primary-6'
                    />
                    <div className='flex flex-wrap items-center justify-between gap-8px'>
                      <div className='flex flex-wrap items-center gap-8px'>
                        <Button
                          size='small'
                          type={marketView === 'curated' ? 'primary' : 'secondary'}
                          className='rounded-[100px]'
                          onClick={() => setMarketView('curated')}
                        >
                          {t('settings.skillsHub.marketCuratedView', { defaultValue: 'Curated' })}
                        </Button>
                        <Button
                          size='small'
                          type={marketView === 'full' ? 'primary' : 'secondary'}
                          className='rounded-[100px]'
                          onClick={() => setMarketView('full')}
                        >
                          {t('settings.skillsHub.marketFullView', { defaultValue: 'Full Library' })}
                        </Button>
                      </div>
                      <div className='flex items-center gap-8px'>
                        <Button
                          size='small'
                          type='text'
                          icon={
                            <Refresh theme='outline' size={16} className={marketRefreshing ? 'animate-spin' : ''} />
                          }
                          onClick={() => void loadSkillMarket({ forceRefresh: true })}
                        >
                          {t('common.refresh', { defaultValue: 'Refresh' })}
                        </Button>
                        <Button
                          size='small'
                          type='outline'
                          onClick={() => void ipcBridge.shell.openExternal.invoke(marketSiteUrl)}
                        >
                          {t('common.website', { defaultValue: 'Website' })}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-10px lg:grid-cols-4'>
                  <div className='rounded-12px border border-border-1 bg-fill-1 p-12px'>
                    <div className='text-20px font-semibold text-t-primary'>
                      {marketStats?.total ?? marketTotalAvailable}
                    </div>
                    <div className='mt-2px text-11px text-t-secondary'>
                      {t('settings.skillsHub.marketCuratedCount', { defaultValue: 'Curated skills' })}
                    </div>
                  </div>
                  <div className='rounded-12px border border-border-1 bg-fill-1 p-12px'>
                    <div className='text-20px font-semibold text-t-primary'>{marketIndustries.length}</div>
                    <div className='mt-2px text-11px text-t-secondary'>
                      {t('settings.skillsHub.marketIndustryCount', { defaultValue: 'Industry tracks' })}
                    </div>
                  </div>
                  <div className='rounded-12px border border-border-1 bg-fill-1 p-12px'>
                    <div className='text-20px font-semibold text-t-primary'>{marketBundles.length}</div>
                    <div className='mt-2px text-11px text-t-secondary'>
                      {t('settings.skillsHub.marketBundleCount', { defaultValue: 'Solution bundles' })}
                    </div>
                  </div>
                  <div className='rounded-12px border border-border-1 bg-fill-1 p-12px'>
                    <div className='text-20px font-semibold text-t-primary'>{marketStats?.clusterCount ?? 0}</div>
                    <div className='mt-2px text-11px text-t-secondary'>
                      {t('settings.skillsHub.marketCapabilityCount', { defaultValue: 'Capability clusters' })}
                    </div>
                  </div>
                </div>

                {marketIndustries.length > 0 ? (
                  <div className='flex gap-8px overflow-x-auto pb-2px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                    <Button
                      size='small'
                      type={marketIndustryId === 'all' ? 'primary' : 'secondary'}
                      className='rounded-[100px]'
                      onClick={() => setMarketIndustryId('all')}
                    >
                      {t('settings.skillsHub.marketIndustryAll', { defaultValue: 'All industries' })}
                    </Button>
                    {marketIndustries.map((industry) => (
                      <Button
                        key={industry.id}
                        size='small'
                        type={marketIndustryId === industry.id ? 'primary' : 'secondary'}
                        className='rounded-[100px]'
                        onClick={() => setMarketIndustryId(industry.id)}
                      >
                        {`${industry.label} (${industry.count})`}
                      </Button>
                    ))}
                  </div>
                ) : null}

                {!marketQuery.trim() && marketBundles.length > 0 ? (
                  <div className='flex flex-col gap-10px'>
                    <div className='flex items-center justify-between gap-12px'>
                      <Typography.Text className='text-13px font-medium text-t-primary'>
                        {t('settings.skillsHub.marketBundlesTitle', { defaultValue: 'Scenario bundles' })}
                      </Typography.Text>
                      <Typography.Text className='text-11px text-t-tertiary'>
                        {t('settings.skillsHub.marketBundlesHint', {
                          defaultValue: 'Install proven combinations instead of assembling skills from scratch',
                        })}
                      </Typography.Text>
                    </div>
                    <div className='grid gap-10px xl:grid-cols-2'>
                      {marketBundles.slice(0, 4).map((bundle) => {
                        const isInstallingBundle = marketInstallingId === `bundle:${bundle.id}`;

                        return (
                          <div key={bundle.id} className='rounded-12px border border-border-1 bg-fill-1 p-16px'>
                            <div className='flex flex-col gap-10px'>
                              <div className='flex items-start justify-between gap-12px'>
                                <div className='min-w-0 flex-1'>
                                  <div className='flex flex-wrap items-center gap-8px'>
                                    <div className='text-14px font-semibold text-t-primary'>{bundle.title}</div>
                                    {bundle.industries.map((industry) => (
                                      <span
                                        key={`${bundle.id}-${industry}`}
                                        className='rounded-[100px] bg-base px-8px py-2px text-10px text-t-secondary'
                                      >
                                        {industry}
                                      </span>
                                    ))}
                                  </div>
                                  <div className='mt-4px text-12px leading-relaxed text-t-secondary'>
                                    {bundle.summary}
                                  </div>
                                </div>
                                <Button
                                  size='small'
                                  type='primary'
                                  loading={isInstallingBundle}
                                  disabled={bundle.skills.length === 0}
                                  className='rounded-[100px]'
                                  onClick={() => void handleInstallMarketBundle(bundle)}
                                >
                                  {t('settings.skillsHub.marketBundleInstall', { defaultValue: 'Install bundle' })}
                                </Button>
                              </div>
                              <div className='flex flex-wrap gap-6px text-11px text-t-tertiary'>
                                <span>
                                  {t('settings.skillsHub.marketBundleSkillsCount', {
                                    count: bundle.skills.length,
                                    defaultValue: '{{count}} skills',
                                  })}
                                </span>
                                {bundle.forTeams ? <span>{bundle.forTeams}</span> : null}
                              </div>
                              <div className='flex flex-wrap gap-6px'>
                                {bundle.steps.slice(0, 4).map((step, index) => (
                                  <span
                                    key={`${bundle.id}-${step.label}`}
                                    className='rounded-[100px] bg-base px-8px py-2px text-10px text-t-secondary'
                                  >
                                    {`${index + 1}. ${step.label}`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className='flex items-center gap-8px text-12px text-t-tertiary'>
                  <FolderOpen size={16} className='shrink-0' />
                  <span className='truncate' title={marketSiteUrl}>
                    {`${marketTotal} / ${marketTotalAvailable} · ${marketSiteUrl}`}
                  </span>
                </div>

                <div className='max-h-[360px] overflow-y-auto custom-scrollbar flex flex-col gap-6px pr-4px'>
                  {marketLoading ? (
                    <div className='text-center text-t-secondary text-13px py-40px bg-fill-1 rd-12px border border-b-base border-dashed'>
                      {t('common.loading', { defaultValue: 'Please wait...' })}
                    </div>
                  ) : marketSkills.length > 0 ? (
                    <>
                      {marketSkills.map((skill) => {
                        const isInstalled = availableSkills.some((available) => available.name === skill.name);
                        const isInstalling = marketInstallingId === skill.id;

                        return (
                          <div
                            key={skill.id}
                            className='group flex flex-col gap-16px border border-transparent bg-base p-16px rd-12px transition-all duration-200 hover:border-border-1 hover:bg-fill-1 hover:shadow-sm sm:flex-row'
                          >
                            <div className='flex shrink-0 items-start sm:mt-2px'>
                              <div
                                className={`flex h-40px w-40px items-center justify-center rd-10px font-bold text-16px shadow-sm text-transform-uppercase ${getAvatarColorClass(skill.displayName || skill.name)}`}
                              >
                                {(skill.displayName || skill.name).charAt(0).toUpperCase()}
                              </div>
                            </div>

                            <div className='flex min-w-0 flex-1 flex-col justify-center gap-6px'>
                              <div className='flex flex-wrap items-center gap-10px'>
                                <h3 className='m-0 truncate text-14px font-semibold text-t-primary/90'>
                                  {skill.displayName || skill.name}
                                </h3>
                                {skill.version ? (
                                  <span className='bg-[rgba(var(--blue-6),0.08)] text-blue-6 border border-[rgba(var(--blue-6),0.2)] text-11px px-6px py-1px rd-4px font-medium'>
                                    {`v${skill.version}`}
                                  </span>
                                ) : null}
                                {skill.primaryCapability ? (
                                  <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 text-11px px-6px py-1px rd-4px font-medium'>
                                    {skill.primaryCapability}
                                  </span>
                                ) : null}
                                {skill.industries[0] || skill.categories[0] ? (
                                  <span className='bg-fill-2 text-t-secondary text-11px px-6px py-1px rd-4px font-medium'>
                                    {skill.industries[0] || skill.categories[0]}
                                  </span>
                                ) : null}
                              </div>
                              {skill.description ? (
                                <p
                                  className='m-0 line-clamp-2 text-13px leading-relaxed text-t-secondary'
                                  title={skill.description}
                                >
                                  {skill.description}
                                </p>
                              ) : null}
                              <div className='text-12px text-t-tertiary'>
                                {[skill.author, `${skill.installs}`, skill.stars ? `${skill.stars}` : '']
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                              {skill.selectionReason ? (
                                <div className='rounded-8px bg-fill-2 px-8px py-6px text-11px text-t-secondary'>
                                  {skill.selectionReason}
                                </div>
                              ) : null}
                            </div>

                            <div className='mt-8px flex shrink-0 items-center sm:mt-0 sm:self-center'>
                              {isInstalled ? (
                                <Button
                                  size='small'
                                  disabled
                                  className='rd-[100px] border-none bg-fill-2 text-t-tertiary'
                                >
                                  {t('settings.installed', { defaultValue: 'Installed' })}
                                </Button>
                              ) : (
                                <Button
                                  size='small'
                                  type='primary'
                                  loading={isInstalling}
                                  disabled={skill.archives.length === 0}
                                  className='rd-[100px] shadow-sm px-16px'
                                  onClick={() => void handleInstallMarketSkill(skill)}
                                >
                                  {skill.archives.length > 0
                                    ? t('common.install', { defaultValue: 'Install' })
                                    : t('settings.skillsHub.marketArchiveUnavailableShort', {
                                        defaultValue: 'Unavailable',
                                      })}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {hasMoreMarketSkills ? (
                        <Button
                          long
                          type='secondary'
                          loading={marketLoadingMore}
                          className='mt-8px rd-8px'
                          onClick={() => void loadSkillMarket({ append: true, nextOffset: marketSkills.length })}
                        >
                          {t('settings.skillsHub.loadMore', { defaultValue: 'Load More' })}
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <div className='text-center text-t-secondary text-13px py-40px bg-fill-1 rd-12px border border-b-base border-dashed'>
                      {t('settings.skillsHub.marketEmpty', {
                        defaultValue: 'No matching skills found in Skill Market',
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ======== 发现外部技能 / Discovered External Skills ======== */}
            {totalExternal > 0 && (
              <div className='px-[16px] md:px-[32px] py-32px bg-base rd-16px md:rd-24px mb-16px shadow-sm border border-b-base relative overflow-hidden transition-all'>
                {/* Section Header with Search Bar */}
                <div className='flex flex-col lg:flex-row lg:items-start justify-between gap-16px mb-24px relative z-10 w-full'>
                  <div className='flex flex-col'>
                    <div className='flex items-center gap-10px mb-8px'>
                      <span className='text-16px md:text-18px text-t-primary font-bold tracking-tight'>
                        {t('settings.skillsHub.discoveredTitle', { defaultValue: 'Discovered External Skills' })}
                      </span>
                      <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 text-12px px-10px py-2px rd-[100px] font-medium ml-4px'>
                        {totalExternal}
                      </span>
                      <button
                        className='outline-none border-none bg-transparent cursor-pointer p-6px text-t-tertiary hover:text-primary-6 transition-colors rd-full hover:bg-fill-2 ml-4px'
                        onClick={() => void handleRefreshExternal()}
                        title={t('common.refresh', { defaultValue: 'Refresh' })}
                      >
                        <Refresh theme='outline' size={16} className={refreshing ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <Typography.Text className='text-13px text-t-secondary block max-w-xl leading-relaxed'>
                      {t('settings.skillsHub.discoveryAlert', {
                        defaultValue: 'Detected skills from your CLI tools. Import them to use in ContextGo.',
                      })}
                    </Typography.Text>
                  </div>

                  {/* Search Bar Outputted inline with Header description in desktop */}
                  <div className='relative group shrink-0 w-full lg:w-[240px]'>
                    <div className='absolute left-12px top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary-6 flex pointer-events-none transition-colors'>
                      <Search size={15} />
                    </div>
                    <input
                      type='text'
                      className='w-full bg-[color:color-mix(in_srgb,var(--bg-1)_92%,var(--fill-1)_8%)] hover:bg-[color:color-mix(in_srgb,var(--bg-1)_96%,var(--fill-1)_4%)] border border-[color:color-mix(in_srgb,var(--border-base)_78%,transparent)] focus:border-[color:color-mix(in_srgb,rgb(var(--primary-6))_42%,var(--border-base))] focus:bg-base outline-none rd-16px py-8px pl-38px pr-14px text-13px text-t-primary placeholder:text-t-tertiary transition-all shadow-[inset_0_1px_0_color-mix(in_srgb,white_18%,transparent),0_10px_24px_color-mix(in_srgb,rgb(15_23_42)_7%,transparent)] focus:shadow-[inset_0_1px_0_color-mix(in_srgb,white_18%,transparent),0_14px_30px_color-mix(in_srgb,rgb(var(--primary-6))_12%,transparent)] box-border m-0'
                      placeholder={t('settings.skillsHub.searchPlaceholder', { defaultValue: 'Search skills...' })}
                      value={searchExternalQuery}
                      onChange={(e) => setSearchExternalQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Toolbar (Tabs) */}
                <div className='flex flex-wrap items-center gap-8px mb-20px relative z-10 w-full'>
                  {externalSources.map((source) => {
                    const isActive = activeSourceTab === source.source;
                    return (
                      <button
                        key={source.source}
                        type='button'
                        className={`outline-none cursor-pointer px-16px py-6px text-13px rd-[100px] transition-all duration-300 flex items-center gap-6px border ${isActive ? 'bg-primary-6 border-primary-6 text-white shadow-md font-medium' : 'bg-base border-border-1 text-t-secondary hover:bg-fill-1 hover:text-t-primary'}`}
                        onClick={() => setActiveSourceTab(source.source)}
                      >
                        {source.name}
                        <span
                          className={`px-6px py-1px rd-[100px] text-11px flex items-center justify-center transition-colors ${isActive ? 'bg-white/20 text-white font-medium' : 'bg-fill-2 text-t-secondary border border-transparent'}`}
                        >
                          {source.skills.length}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type='button'
                    className='outline-none border border-dashed border-border-1 hover:border-primary-4 cursor-pointer w-28px h-28px ml-4px text-t-tertiary hover:text-primary-6 hover:bg-primary-1 rd-full transition-all duration-300 flex items-center justify-center bg-transparent shrink-0'
                    onClick={() => setShowAddPathModal(true)}
                    title={t('common.add', { defaultValue: 'Add' })}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {/* Active tab content */}
                {activeSource && (
                  <div className='flex flex-col'>
                    <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-12px py-8px mb-4px'>
                      <div className='flex items-center gap-8px text-12px text-t-tertiary font-mono min-w-0 bg-transparent py-4px'>
                        <FolderOpen size={16} className='shrink-0' />
                        <span className='truncate' title={activeSource.path}>
                          {activeSource.path}
                        </span>
                      </div>
                      <button
                        className='flex items-center gap-6px text-13px font-medium text-primary-6 hover:text-primary-5 transition-colors bg-transparent border-none outline-none cursor-pointer whitespace-nowrap'
                        onClick={() => void handleImportAll(activeSource.skills)}
                      >
                        {t('settings.skillsHub.importAll', { defaultValue: 'Import All' })}
                      </button>
                    </div>

                    <div className='max-h-[360px] overflow-y-auto custom-scrollbar flex flex-col gap-6px pr-4px'>
                      {filteredExternalSkills.map((skill) => (
                        <div
                          key={skill.path}
                          className='group flex flex-col sm:flex-row gap-16px p-16px bg-base border border-transparent hover:border-border-1 hover:bg-fill-1 hover:shadow-sm rd-12px transition-all duration-200 cursor-pointer'
                          onClick={() => void handleImport(skill.path)}
                        >
                          <div className='shrink-0 flex items-start sm:mt-2px'>
                            <div className='w-40px h-40px rd-full bg-base border border-border-1 flex items-center justify-center font-bold text-16px text-t-primary shadow-sm transition-all text-transform-uppercase'>
                              {skill.name.charAt(0)}
                            </div>
                          </div>
                          <div className='flex-1 min-w-0 flex flex-col justify-center'>
                            <h3 className='text-14px font-semibold text-t-primary/90 mb-6px truncate m-0'>
                              {skill.name}
                            </h3>
                            {skill.description && (
                              <p
                                className='text-13px text-t-secondary leading-relaxed line-clamp-2 m-0'
                                title={skill.description}
                              >
                                {skill.description}
                              </p>
                            )}
                          </div>
                          <div className='shrink-0 sm:self-center flex items-center mt-8px sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity'>
                            <Button
                              size='small'
                              type='primary'
                              status='default'
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleImport(skill.path);
                              }}
                              className='rd-[100px] shadow-sm px-16px'
                            >
                              {t('common.import', { defaultValue: 'Import' })}
                            </Button>
                          </div>
                        </div>
                      ))}
                      {filteredExternalSkills.length === 0 && (
                        <div className='text-center text-t-secondary text-13px py-40px bg-fill-1 rd-12px border border-b-base border-dashed'>
                          {t('settings.skillsHub.noSearchResults', { defaultValue: 'No matching skills found' })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ======== 我的技能 / My Skills ======== */}
            <div className='px-[16px] md:px-[32px] py-32px bg-base rd-16px md:rd-24px shadow-sm border border-b-base relative overflow-hidden transition-all'>
              {/* Toolbar for My Skills */}
              <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-16px mb-24px relative z-10'>
                <div className='flex items-center gap-10px shrink-0'>
                  <span className='text-16px md:text-18px text-t-primary font-bold tracking-tight'>
                    {t('settings.skillsHub.mySkillsTitle', { defaultValue: 'My Skills' })}
                  </span>
                  <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 text-12px px-10px py-2px rd-[100px] font-medium ml-4px'>
                    {availableSkills.length}
                  </span>
                  <button
                    className='outline-none border-none bg-transparent cursor-pointer p-6px text-t-tertiary hover:text-primary-6 transition-colors rd-full hover:bg-fill-2 ml-4px'
                    onClick={async () => {
                      await fetchData();
                      Message.success(t('common.refreshSuccess', { defaultValue: 'Refreshed' }));
                    }}
                    title={t('common.refresh', { defaultValue: 'Refresh' })}
                  >
                    <Refresh theme='outline' size={16} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-12px w-full lg:w-auto shrink-0'>
                  <div className='relative group shrink-0 w-full sm:w-[200px] lg:w-[240px]'>
                    <div className='absolute left-12px top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary-6 flex pointer-events-none transition-colors'>
                      <Search size={15} />
                    </div>
                    <input
                      type='text'
                      className='w-full bg-[color:color-mix(in_srgb,var(--bg-1)_92%,var(--fill-1)_8%)] hover:bg-[color:color-mix(in_srgb,var(--bg-1)_96%,var(--fill-1)_4%)] border border-[color:color-mix(in_srgb,var(--border-base)_78%,transparent)] focus:border-[color:color-mix(in_srgb,rgb(var(--primary-6))_42%,var(--border-base))] focus:bg-base outline-none rd-16px py-8px pl-38px pr-14px text-13px text-t-primary placeholder:text-t-tertiary transition-all shadow-[inset_0_1px_0_color-mix(in_srgb,white_18%,transparent),0_10px_24px_color-mix(in_srgb,rgb(15_23_42)_7%,transparent)] focus:shadow-[inset_0_1px_0_color-mix(in_srgb,white_18%,transparent),0_14px_30px_color-mix(in_srgb,rgb(var(--primary-6))_12%,transparent)] box-border m-0'
                      placeholder={t('settings.skillsHub.searchPlaceholder', { defaultValue: 'Search skills...' })}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <button
                    className='flex items-center justify-center gap-6px px-16px py-6px bg-base border border-border-1 hover:border-border-2 hover:bg-fill-1 text-t-primary rd-8px shadow-sm transition-all focus:outline-none shrink-0 cursor-pointer whitespace-nowrap'
                    onClick={handleManualImport}
                  >
                    <FolderOpen size={15} className='text-t-secondary' />
                    <span className='text-13px font-medium'>
                      {t('settings.skillsHub.manualImport', { defaultValue: 'Import from Folder' })}
                    </span>
                  </button>
                </div>
              </div>

              {/* Path Display moved below the toolbar */}
              {skillPaths && (
                <div className='flex items-center gap-8px text-12px text-t-tertiary font-mono bg-transparent py-4px mb-16px relative z-10 pt-4px border-t border-t-transparent'>
                  <FolderOpen size={16} className='shrink-0' />
                  <span className='truncate' title={skillPaths.userSkillsDir}>
                    {skillPaths.userSkillsDir}
                  </span>
                </div>
              )}

              {availableSkills.length > 0 ? (
                <div className='w-full flex flex-col gap-6px relative z-10'>
                  {filteredSkills.map((skill) => (
                    <div
                      key={skill.name}
                      className='group flex flex-col sm:flex-row gap-16px p-16px bg-base border border-transparent hover:border-border-1 hover:bg-fill-1 hover:shadow-sm rd-12px transition-all duration-200'
                    >
                      <div className='shrink-0 flex items-start sm:mt-2px'>
                        <div
                          className={`w-40px h-40px rd-10px flex items-center justify-center font-bold text-16px shadow-sm text-transform-uppercase ${getAvatarColorClass(skill.name)}`}
                        >
                          {skill.name.charAt(0).toUpperCase()}
                        </div>
                      </div>

                      <div className='flex-1 min-w-0 flex flex-col justify-center gap-6px'>
                        <div className='flex items-center gap-10px flex-wrap'>
                          <h3 className='text-14px font-semibold text-t-primary/90 truncate m-0'>{skill.name}</h3>
                          {skill.isCustom ? (
                            <span className='bg-[rgba(var(--orange-6),0.08)] text-orange-6 border border-[rgba(var(--orange-6),0.2)] text-11px px-6px py-1px rd-4px font-medium'>
                              {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
                            </span>
                          ) : (
                            <span className='bg-[rgba(var(--blue-6),0.08)] text-blue-6 border border-[rgba(var(--blue-6),0.2)] text-11px px-6px py-1px rd-4px font-medium'>
                              {t('settings.skillsHub.builtin', { defaultValue: 'Built-in' })}
                            </span>
                          )}
                        </div>
                        {skill.description && (
                          <p
                            className='text-13px text-t-secondary leading-relaxed line-clamp-2 m-0'
                            title={skill.description}
                          >
                            {skill.description}
                          </p>
                        )}
                        {renderSkillDependencyTags(skill)}
                        {renderSkillCompatibilityNotes(skill)}
                      </div>

                      <div className='shrink-0 sm:self-center flex items-center justify-end gap-6px mt-12px sm:mt-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity pl-4px'>
                        {externalSources.length > 0 && (
                          <Dropdown
                            trigger='click'
                            position='bl'
                            droplist={
                              <Menu>
                                {externalSources.map((source) => (
                                  <Menu.Item
                                    key={source.source}
                                    onClick={async (e) => {
                                      e.stopPropagation();

                                      const hide = Message.loading({
                                        content: t('common.processing', { defaultValue: 'Processing...' }),
                                        duration: 0,
                                      });
                                      try {
                                        const skillPath = skill.location.replace(/[\\/]SKILL\.md$/, '');

                                        const result = await Promise.race([
                                          ipcBridge.fs.exportSkillWithSymlink.invoke({
                                            skillPath,
                                            targetDir: source.path,
                                          }),
                                          new Promise<{ success: boolean; msg: string }>((_, reject) =>
                                            setTimeout(() => reject(new Error('Export timed out.')), 8000)
                                          ),
                                        ]);

                                        hide();
                                        if (result.success) {
                                          Message.success(
                                            t('settings.skillsHub.exportSuccess', {
                                              defaultValue: 'Skill exported successfully',
                                            })
                                          );
                                        } else {
                                          Message.error(
                                            result.msg ||
                                              t('settings.skillsHub.exportFailed', {
                                                defaultValue: 'Failed to export skill',
                                              })
                                          );
                                        }
                                      } catch (error) {
                                        hide();
                                        console.error('[SkillsHub] Export error:', error);
                                        const errMsg = error instanceof Error ? error.message : String(error);
                                        Message.error(errMsg);
                                      }
                                    }}
                                  >
                                    {source.name}
                                  </Menu.Item>
                                ))}
                              </Menu>
                            }
                          >
                            <button
                              className='p-8px hover:bg-fill-2 text-t-tertiary hover:text-t-secondary rd-6px outline-none flex items-center justify-center border border-transparent cursor-pointer transition-colors shadow-sm bg-base sm:bg-transparent sm:shadow-none'
                              title={t('settings.skillsHub.exportTo', { defaultValue: 'Export To...' })}
                            >
                              <span className='text-12px font-medium'>
                                {t('settings.skillsHub.exportTo', { defaultValue: 'Export' })}
                              </span>
                            </button>
                          </Dropdown>
                        )}
                        {skill.isCustom && (
                          <button
                            className='p-8px hover:bg-danger-1 hover:text-danger-6 text-t-tertiary rd-6px outline-none flex items-center justify-center border border-transparent cursor-pointer transition-colors shadow-sm bg-base sm:bg-transparent sm:shadow-none'
                            onClick={() => setDeleteSkillName(skill.name)}
                            title={t('common.delete', { defaultValue: 'Delete' })}
                          >
                            <Delete size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center text-t-secondary text-13px py-40px bg-fill-1 rd-12px border border-b-base border-dashed relative z-10'>
                  {loading
                    ? t('common.loading', { defaultValue: 'Please wait...' })
                    : t('settings.skillsHub.noSkills', {
                        defaultValue: 'No skills found. Import some to get started.',
                      })}
                </div>
              )}
            </div>

            {/* ======== Usage Tip ======== */}
            <div className='px-16px md:px-[24px] py-20px bg-base border border-b-base shadow-sm rd-16px flex items-start gap-12px text-t-secondary'>
              <Info size={18} className='text-primary-6 mt-2px shrink-0' />
              <div className='flex flex-col gap-4px'>
                <span className='font-bold text-t-primary text-14px'>
                  {t('settings.skillsHub.tipTitle', { defaultValue: 'Usage Tip:' })}
                </span>
                <span className='text-13px leading-relaxed'>{t('settings.skillsHub.tipContent')}</span>
              </div>
            </div>
          </div>
        </div>
      </SettingsPageWrapper>

      <SettingsSubModal
        visible={showAddPathModal}
        onCancel={() => {
          setShowAddPathModal(false);
          setCustomPathName('');
          setCustomPathValue('');
        }}
        title={t('settings.skillsHub.addCustomPath', { defaultValue: 'Add Custom Skill Path' })}
        onOk={() => void handleAddCustomPath()}
        okButtonProps={{ disabled: !customPathName.trim() || !customPathValue.trim() }}
        style={{ width: 'min(560px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
        autoFocus={false}
        focusLock
      >
        <div className='flex flex-col gap-16px'>
          <div>
            <div className='text-13px font-medium text-t-primary mb-8px'>
              {t('common.name', { defaultValue: 'Name' })}
            </div>
            <Input
              placeholder={t('settings.skillsHub.customPathNamePlaceholder', { defaultValue: 'e.g. My Custom Skills' })}
              value={customPathName}
              onChange={(v) => setCustomPathName(v)}
              className='rd-6px'
            />
          </div>
          <div>
            <div className='text-13px font-medium text-t-primary mb-8px'>
              {t('settings.skillsHub.customPathLabel', { defaultValue: 'Skill Directory Path' })}
            </div>
            <div className='flex gap-8px'>
              <Input
                placeholder={t('settings.skillsHub.customPathPlaceholder', {
                  defaultValue: 'e.g. C:\\Users\\me\\.mytools\\skills',
                })}
                value={customPathValue}
                onChange={(v) => setCustomPathValue(v)}
                className='flex-1 rd-6px'
              />
              <Button
                className='rd-6px'
                onClick={async () => {
                  try {
                    const result = await ipcBridge.dialog.showOpen.invoke({ properties: ['openDirectory'] });
                    if (result && result.length > 0) {
                      setCustomPathValue(result[0]);
                    }
                  } catch (e) {
                    console.error('Failed to select directory', e);
                  }
                }}
              >
                <FolderOpen size={16} />
              </Button>
            </div>
          </div>
        </div>
      </SettingsSubModal>

      <SettingsSubModal
        visible={deleteSkillName !== null}
        onCancel={() => setDeleteSkillName(null)}
        title={t('settings.skillsHub.deleteConfirmTitle', { defaultValue: 'Delete Skill' })}
        onOk={() => {
          if (!deleteSkillName) {
            return;
          }
          void handleDelete(deleteSkillName);
          setDeleteSkillName(null);
        }}
        okText={t('common.delete', { defaultValue: 'Delete' })}
        okButtonProps={{ status: 'danger' }}
        style={{ width: 'min(440px, calc(100vw - 32px))' }}
        contentStyle={{ padding: '12px 24px 24px' }}
      >
        <div className='settings-sub-modal__stack'>
          <p className='settings-sub-modal__lead'>
            {t('settings.skillsHub.deleteConfirmContent', {
              name: deleteSkillName || '',
              defaultValue: `Are you sure you want to delete "${deleteSkillName || ''}"?`,
            })}
          </p>
          {deleteSkillName ? (
            <div className='settings-sub-modal__entity-card settings-sub-modal__entity-card--danger'>
              <div className='settings-sub-modal__meta'>
                <div className='settings-sub-modal__meta-title'>{deleteSkillName}</div>
              </div>
            </div>
          ) : null}
        </div>
      </SettingsSubModal>
    </>
  );
};

export default SkillsHubSettings;
