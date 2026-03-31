import { ipcBridge } from '@/common';
import type { Message } from '@arco-design/web-react';
import type {
  AddableSkill,
  ExternalSource,
  PendingSkill,
  SkillInfo,
  SkillMarketBundle,
  SkillMarketIndustry,
  SkillMarketItem,
  SkillMarketStats,
  SkillMarketView,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type UseAssistantSkillsParams = {
  skillsModalVisible: boolean;
  customSkills: string[];
  selectedSkills: string[];
  pendingSkills: PendingSkill[];
  availableSkills: SkillInfo[];
  setPendingSkills: (skills: PendingSkill[]) => void;
  setCustomSkills: (skills: string[]) => void;
  setSelectedSkills: (skills: string[]) => void;
  message: ReturnType<typeof Message.useMessage>[0];
};

/**
 * Manages external skill sources discovery, searching, filtering,
 * and custom path management for the Add Skills modal.
 */
export const useAssistantSkills = ({
  skillsModalVisible,
  customSkills,
  selectedSkills,
  pendingSkills,
  availableSkills,
  setPendingSkills,
  setCustomSkills,
  setSelectedSkills,
  message,
}: UseAssistantSkillsParams) => {
  const { t } = useTranslation();

  const [browseMode, setBrowseMode] = useState<'skill-market' | 'external'>('skill-market');
  const [externalSources, setExternalSources] = useState<ExternalSource[]>([]);
  const [activeSourceTab, setActiveSourceTab] = useState<string>('');
  const [searchExternalQuery, setSearchExternalQuery] = useState('');
  const [externalSkillsLoading, setExternalSkillsLoading] = useState(false);
  const [marketSkills, setMarketSkills] = useState<SkillMarketItem[]>([]);
  const [marketQuery, setMarketQuery] = useState('');
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
  const [showAddPathModal, setShowAddPathModal] = useState(false);
  const [customPathName, setCustomPathName] = useState('');
  const [customPathValue, setCustomPathValue] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [skillPath, setSkillPath] = useState('');
  const [commonPaths, setCommonPaths] = useState<Array<{ name: string; path: string }>>([]);

  // Reload external skills data
  const handleRefreshExternal = useCallback(async () => {
    setExternalSkillsLoading(true);
    setRefreshing(true);
    try {
      const response = await ipcBridge.fs.detectAndCountExternalSkills.invoke();
      if (response.success && response.data) {
        setExternalSources(response.data);
        if (response.data.length > 0 && !response.data.find((s) => s.source === activeSourceTab)) {
          setActiveSourceTab(response.data[0].source);
        }
      }
    } catch (error) {
      console.error('Failed to detect external skills:', error);
    } finally {
      setExternalSkillsLoading(false);
      setRefreshing(false);
    }
  }, [activeSourceTab]);

  const loadSkillMarket = useCallback(
    async ({
      append = false,
      forceRefresh = false,
      nextQuery,
      nextView,
      nextIndustryId,
    }: {
      append?: boolean;
      forceRefresh?: boolean;
      nextQuery?: string;
      nextView?: SkillMarketView;
      nextIndustryId?: string;
    } = {}) => {
      const query = nextQuery ?? marketQuery;
      const view = nextView ?? marketView;
      const industryId = nextIndustryId ?? marketIndustryId;

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
          offset: append ? marketSkills.length : 0,
          forceRefresh,
          view,
          industryId: industryId === 'all' ? undefined : industryId,
        });

        if (!response.success || !response.data) {
          message.error(
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
        message.error(
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
    [marketIndustryId, marketQuery, marketSkills.length, marketView, message, t]
  );

  // Detect external skill paths when modal opens
  useEffect(() => {
    if (skillsModalVisible) {
      setBrowseMode('skill-market');
      setSearchExternalQuery('');
      setMarketQuery('');
      setMarketView('curated');
      setMarketIndustryId('all');
      void handleRefreshExternal();
    }
  }, [skillsModalVisible, handleRefreshExternal]);

  useEffect(() => {
    if (!skillsModalVisible) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSkillMarket({ nextQuery: marketQuery });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [skillsModalVisible, marketIndustryId, marketQuery, marketView, loadSkillMarket]);

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
        message.success(t('common.success', { defaultValue: 'Successfully added path' }));
        void handleRefreshExternal();
      } else {
        message.error(
          result.msg ||
            t('settings.skillsHub.addPathFailed', {
              defaultValue: 'Failed to add path',
            })
        );
      }
    } catch {
      message.error(
        t('settings.skillsHub.addCustomPathFailed', {
          defaultValue: 'Failed to add custom path',
        })
      );
    }
  }, [customPathName, customPathValue, handleRefreshExternal, message, t]);

  const handleAddFoundSkills = (skillsToAdd: AddableSkill[]) => {
    let addedCount = 0;
    let skippedCount = 0;
    const newPendingSkills: PendingSkill[] = [];
    const newCustomSkillNames: string[] = [];
    const newSelectedSkills: string[] = [];

    for (const skill of skillsToAdd) {
      const { name, description } = skill;
      // Check if already in this assistant's list
      const alreadyInAssistant = customSkills.includes(name) || newCustomSkillNames.includes(name);

      if (alreadyInAssistant) {
        skippedCount++;
        continue;
      }

      // Check if already exists in system
      const existsInAvailable = availableSkills.some((s) => s.name === name);
      const existsInPending = pendingSkills.some((s) => s.name === name);

      if (!existsInAvailable && !existsInPending) {
        if (skill.source === 'external') {
          newPendingSkills.push({ source: 'external', path: skill.path, name, description });
        } else {
          const preferredArchive = skill.archives[0];
          if (!preferredArchive) {
            skippedCount++;
            message.warning(
              t('settings.skillsHub.marketArchiveUnavailable', {
                name,
                defaultValue: 'No downloadable package is available for "{{name}}"',
              })
            );
            continue;
          }

          newPendingSkills.push({
            source: 'skill-market',
            marketSkillId: skill.id,
            name,
            description,
            archive: preferredArchive,
          });
        }
      }

      newCustomSkillNames.push(name);
      newSelectedSkills.push(name);
      addedCount++;
    }

    if (addedCount > 0) {
      setPendingSkills([...pendingSkills, ...newPendingSkills]);
      setCustomSkills([...customSkills, ...newCustomSkillNames]);
      setSelectedSkills([...selectedSkills, ...newSelectedSkills]);
      const skippedCountText =
        skippedCount > 0
          ? ` (${t('settings.skippedCount', { count: skippedCount, defaultValue: `${skippedCount} skipped` })})`
          : '';
      message.success(
        t('settings.skillsAdded', {
          addedCount,
          skippedCountText,
          defaultValue: `${addedCount} skills added and selected${skippedCountText}`,
        })
      );
    } else if (skippedCount > 0) {
      message.warning(t('settings.allSkillsExist', { defaultValue: 'All found skills already exist' }));
    }
  };

  const handleAddMarketBundle = (bundle: SkillMarketBundle) => {
    handleAddFoundSkills(
      bundle.skills.map((skill) => ({
        ...skill,
        source: 'skill-market' as const,
      }))
    );
  };

  const activeSource = externalSources.find((s) => s.source === activeSourceTab);

  const filteredExternalSkills = React.useMemo(() => {
    if (!activeSource) return [];
    if (!searchExternalQuery.trim()) return activeSource.skills;
    const lowerQuery = searchExternalQuery.toLowerCase();
    return activeSource.skills.filter(
      (s) =>
        s.name.toLowerCase().includes(lowerQuery) || (s.description && s.description.toLowerCase().includes(lowerQuery))
    );
  }, [activeSource, searchExternalQuery]);

  const hasMoreMarketSkills = marketSkills.length < marketTotal;

  return {
    browseMode,
    setBrowseMode,
    externalSources,
    activeSourceTab,
    setActiveSourceTab,
    searchExternalQuery,
    setSearchExternalQuery,
    externalSkillsLoading,
    showAddPathModal,
    setShowAddPathModal,
    customPathName,
    setCustomPathName,
    customPathValue,
    setCustomPathValue,
    refreshing,
    skillPath,
    setSkillPath,
    commonPaths,
    setCommonPaths,
    marketSkills,
    marketQuery,
    setMarketQuery,
    marketView,
    setMarketView,
    marketIndustryId,
    setMarketIndustryId,
    marketLoading,
    marketLoadingMore,
    marketRefreshing,
    marketBrandName,
    marketTotal,
    marketTotalAvailable,
    marketSiteUrl,
    marketStats,
    marketIndustries,
    marketBundles,
    hasMoreMarketSkills,
    activeSource,
    filteredExternalSkills,
    handleRefreshExternal,
    handleRefreshSkillMarket: () => loadSkillMarket({ forceRefresh: true }),
    handleLoadMoreSkillMarket: () => loadSkillMarket({ append: true }),
    handleAddCustomPath,
    handleAddFoundSkills,
    handleAddMarketBundle,
  };
};
