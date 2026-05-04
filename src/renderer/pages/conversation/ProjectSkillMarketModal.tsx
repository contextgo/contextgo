import { ipcBridge } from '@/common';
import type { IProjectCapabilitySnapshot } from '@/common/adapter/ipcBridge';
import { SettingsSubModal } from '@/renderer/components/settings';
import type {
  SkillInfo,
  SkillMarketBundle,
  SkillMarketIndustry,
  SkillMarketItem,
  SkillMarketView,
} from '@/renderer/pages/settings/AgentSettings/AssistantManagement/types';
import { getWorkspaceAutomationPaths, getWorkspaceDisplayName } from '@/renderer/utils/workspace/workspace';
import { Button, Input, Message, Typography } from '@arco-design/web-react';
import { Refresh, Search } from '@icon-park/react';
import React, { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

type ProjectSkillMarketModalProps = {
  visible: boolean;
  workspacePath: string;
  onClose: () => void;
  variant?: 'modal' | 'embedded';
};

type SkillMarketResultData = NonNullable<Awaited<ReturnType<typeof ipcBridge.fs.searchSkillMarket.invoke>>['data']>;

type SkillMarketCacheEntry = {
  createdAt: number;
  data: SkillMarketResultData;
};

const PROJECT_SKILL_MARKET_CACHE_TTL_MS = 5 * 60 * 1000;
const PROJECT_QUERY_MAX_TERMS = 10;
const PROJECT_QUERY_STOP_WORDS = new Set([
  'app',
  'code',
  'context',
  'dist',
  'for',
  'main',
  'node',
  'project',
  'repo',
  'src',
  'tmp',
  'user',
  'users',
  'workspace',
  'workspaces',
]);
const skillMarketSearchCache = new Map<string, SkillMarketCacheEntry>();

export const clearProjectSkillMarketCacheForTests = (): void => {
  skillMarketSearchCache.clear();
};

const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '');

const resolveSkillTitle = (skill: SkillMarketItem): string => skill.displayName || skill.name;

const resolveWorkspaceInstalledSkillNames = (skills: SkillInfo[], workspaceSkillsDir: string): Set<string> => {
  const normalizedWorkspaceSkillsDir = normalizePath(workspaceSkillsDir);

  return new Set(
    skills
      .filter((skill) => normalizePath(skill.location).startsWith(normalizedWorkspaceSkillsDir))
      .flatMap((skill) =>
        [skill.name, skill.openAIConfig?.interface?.displayName].filter((value): value is string => Boolean(value))
      )
  );
};

const getWorkspacePathSegments = (workspacePath: string): string[] =>
  normalizePath(workspacePath).split('/').filter(Boolean).slice(-2);

const tokenizeProjectSignal = (value: string | null | undefined): string[] => {
  if (!value) {
    return [];
  }

  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length >= 3 && !PROJECT_QUERY_STOP_WORDS.has(part));
};

const buildProjectRecommendationQuery = (
  workspacePath: string,
  workspaceDisplayName: string,
  snapshot?: IProjectCapabilitySnapshot
): string => {
  const terms: string[] = [];
  const addTerms = (value: string | null | undefined) => {
    for (const term of tokenizeProjectSignal(value)) {
      if (!terms.includes(term)) {
        terms.push(term);
      }
      if (terms.length >= PROJECT_QUERY_MAX_TERMS) {
        return;
      }
    }
  };

  addTerms(workspaceDisplayName);
  getWorkspacePathSegments(workspacePath).forEach(addTerms);
  snapshot?.skills.slice(0, 4).forEach((skill) => {
    addTerms(skill.openAIDisplayName || skill.name);
    addTerms(skill.openAIShortDescription || skill.description);
  });
  snapshot?.commands.slice(0, 2).forEach((command) => {
    addTerms(command.name);
    addTerms(command.description);
  });

  return terms.slice(0, PROJECT_QUERY_MAX_TERMS).join(' ');
};

const buildSkillMarketCacheKey = (params: {
  workspacePath: string;
  query: string;
  view: SkillMarketView;
  industryId: string;
  offset: number;
}): string =>
  JSON.stringify({
    workspacePath: normalizePath(params.workspacePath),
    query: params.query.trim(),
    view: params.view,
    industryId: params.industryId,
    offset: params.offset,
  });

const ProjectSkillMarketModal: React.FC<ProjectSkillMarketModalProps> = ({
  visible,
  workspacePath,
  onClose,
  variant = 'modal',
}) => {
  const { t } = useTranslation();
  const [messageApi, messageContext] = Message.useMessage();
  const [marketSkills, setMarketSkills] = useState<SkillMarketItem[]>([]);
  const [marketQuery, setMarketQuery] = useState('');
  const [projectRecommendationQuery, setProjectRecommendationQuery] = useState('');
  const [projectRecommendationFallbackActive, setProjectRecommendationFallbackActive] = useState(false);
  const [projectRecommendationReady, setProjectRecommendationReady] = useState(false);
  const [useProjectRecommendations, setUseProjectRecommendations] = useState(true);
  const [marketView, setMarketView] = useState<SkillMarketView>('curated');
  const [marketIndustryId, setMarketIndustryId] = useState('all');
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [marketTotal, setMarketTotal] = useState(0);
  const [marketBrandName, setMarketBrandName] = useState('ContextGo');
  const [marketSiteUrl, setMarketSiteUrl] = useState('https://www.skillmarket.com.cn');
  const [marketIndustries, setMarketIndustries] = useState<SkillMarketIndustry[]>([]);
  const [marketBundles, setMarketBundles] = useState<SkillMarketBundle[]>([]);
  const [marketInstallingId, setMarketInstallingId] = useState<string | null>(null);
  const [installedSkillNames, setInstalledSkillNames] = useState<Set<string>>(new Set());

  const automationPaths = useMemo(() => getWorkspaceAutomationPaths(workspacePath), [workspacePath]);
  const workspaceDisplayName = useMemo(() => getWorkspaceDisplayName(workspacePath, t), [workspacePath, t]);
  const hasMoreMarketSkills = marketSkills.length < marketTotal;
  const effectiveMarketQuery =
    useProjectRecommendations && !marketQuery.trim()
      ? projectRecommendationFallbackActive
        ? ''
        : projectRecommendationQuery
      : marketQuery;

  const refreshInstalledSkills = useEffectEvent(async () => {
    const skills = await ipcBridge.fs.listAvailableSkills.invoke({ workspacePath });
    setInstalledSkillNames(resolveWorkspaceInstalledSkillNames(skills, automationPaths.skillsDir));
  });

  const isMarketSkillInstalled = useCallback(
    (skill: SkillMarketItem) =>
      installedSkillNames.has(skill.name) || installedSkillNames.has(resolveSkillTitle(skill)),
    [installedSkillNames]
  );

  const applySkillMarketData = useEffectEvent((data: SkillMarketResultData, append: boolean) => {
    setMarketSkills((current) => (append ? [...current, ...data.items] : data.items));
    setMarketTotal(data.total);
    setMarketBrandName(data.brandName);
    setMarketSiteUrl(data.siteUrl);
    setMarketIndustries(data.industryIndex ?? []);
    setMarketBundles(data.bundles ?? []);
  });

  const loadSkillMarket = useEffectEvent(
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
      const cacheKey = buildSkillMarketCacheKey({
        workspacePath,
        query,
        view,
        industryId,
        offset,
      });
      const cached = skillMarketSearchCache.get(cacheKey);

      if (!append && !forceRefresh && cached && Date.now() - cached.createdAt < PROJECT_SKILL_MARKET_CACHE_TTL_MS) {
        applySkillMarketData(cached.data, false);
        return cached.data;
      }

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
          limit: 12,
          offset,
          forceRefresh,
          view,
          ...(industryId === 'all' ? {} : { industryId }),
        });

        if (!response.success || !response.data) {
          messageApi.error(
            response.msg ||
              t('conversation.workspace.skillMarket.loadFailed', {
                defaultValue: 'Failed to load project Skill Market',
              })
          );
          return null;
        }

        if (!append && offset === 0) {
          skillMarketSearchCache.set(cacheKey, {
            createdAt: Date.now(),
            data: response.data,
          });
        }
        applySkillMarketData(response.data, append);
        return response.data;
      } catch (error) {
        console.error('Failed to load project Skill Market:', error);
        messageApi.error(
          t('conversation.workspace.skillMarket.loadFailed', {
            defaultValue: 'Failed to load project Skill Market',
          })
        );
        return null;
      } finally {
        setMarketLoading(false);
        setMarketLoadingMore(false);
        setMarketRefreshing(false);
      }
    }
  );

  const handleInstallSkill = useCallback(
    async (skill: SkillMarketItem) => {
      const preferredArchive = skill.archives[0];
      if (!preferredArchive) {
        messageApi.warning(
          t('conversation.workspace.skillMarket.archiveUnavailable', {
            name: resolveSkillTitle(skill),
            defaultValue: 'No downloadable package is available for "{{name}}"',
          })
        );
        return;
      }

      setMarketInstallingId(skill.id);
      try {
        const result = await ipcBridge.fs.installSkillMarketSkillToWorkspace.invoke({
          workspacePath,
          skillId: skill.id,
          archive: preferredArchive,
        });

        if (!result.success) {
          messageApi.error(
            result.msg ||
              t('conversation.workspace.skillMarket.installFailed', {
                name: resolveSkillTitle(skill),
                defaultValue: 'Failed to add "{{name}}" to this project',
              })
          );
          return;
        }

        messageApi.success(
          result.msg ||
            t('conversation.workspace.skillMarket.installSuccess', {
              name: resolveSkillTitle(skill),
              defaultValue: 'Added "{{name}}" to this project',
            })
        );
        await refreshInstalledSkills();
      } catch (error) {
        console.error('Failed to install project Skill Market skill:', error);
        messageApi.error(
          t('conversation.workspace.skillMarket.installFailed', {
            name: resolveSkillTitle(skill),
            defaultValue: 'Failed to add "{{name}}" to this project',
          })
        );
      } finally {
        setMarketInstallingId(null);
      }
    },
    [messageApi, refreshInstalledSkills, t, workspacePath]
  );

  const handleInstallBundle = useCallback(
    async (bundle: SkillMarketBundle) => {
      const installableSkills = bundle.skills.filter(
        (skill) => skill.archives.length > 0 && !isMarketSkillInstalled(skill)
      );

      if (installableSkills.length === 0) {
        messageApi.warning(
          t('conversation.workspace.skillMarket.bundleNoInstallableSkills', {
            defaultValue: 'All skills in this bundle are already installed or unavailable.',
          })
        );
        return;
      }

      setMarketInstallingId(`bundle:${bundle.id}`);
      try {
        const installResults = await Promise.all(
          installableSkills.map(async (skill) => ({
            skill,
            result: await ipcBridge.fs.installSkillMarketSkillToWorkspace.invoke({
              workspacePath,
              skillId: skill.id,
              archive: skill.archives[0],
            }),
          }))
        );
        const failedInstall = installResults.find(({ result }) => !result.success);

        if (failedInstall) {
          throw new Error(
            failedInstall.result.msg ||
              t('conversation.workspace.skillMarket.installFailed', {
                name: resolveSkillTitle(failedInstall.skill),
                defaultValue: 'Failed to add "{{name}}" to this project',
              })
          );
        }

        messageApi.success(
          t('conversation.workspace.skillMarket.bundleInstallSuccess', {
            name: bundle.title,
            count: installableSkills.length,
            defaultValue: 'Added {{count}} skills from "{{name}}" to this project',
          })
        );
        await refreshInstalledSkills();
      } catch (error) {
        console.error('Failed to install project Skill Market bundle:', error);
        messageApi.error(
          error instanceof Error
            ? error.message
            : t('conversation.workspace.skillMarket.bundleInstallFailed', {
                name: bundle.title,
                defaultValue: 'Failed to add bundle "{{name}}" to this project',
              })
        );
      } finally {
        setMarketInstallingId(null);
      }
    },
    [isMarketSkillInstalled, messageApi, refreshInstalledSkills, t, workspacePath]
  );

  const resolveAndLoadProjectRecommendations = useEffectEvent(async () => {
    let snapshot: IProjectCapabilitySnapshot | undefined;
    try {
      snapshot = await ipcBridge.conversation.getProjectCapabilitySnapshot.invoke({ workspacePath });
    } catch (error) {
      console.warn('Failed to load project capability snapshot for Skill Market recommendations:', error);
    }

    const recommendationQuery = buildProjectRecommendationQuery(workspacePath, workspaceDisplayName, snapshot);
    setProjectRecommendationQuery(recommendationQuery);
    setProjectRecommendationFallbackActive(false);
    const recommendationResult = await loadSkillMarket({
      nextQuery: recommendationQuery,
      nextView: 'curated',
      nextIndustryId: 'all',
    });
    if (recommendationQuery && recommendationResult?.items.length === 0 && recommendationResult.totalAvailable > 0) {
      setProjectRecommendationFallbackActive(true);
      await loadSkillMarket({
        nextQuery: '',
        nextView: 'curated',
        nextIndustryId: 'all',
      });
    }
    setProjectRecommendationReady(true);
  });

  useEffect(() => {
    if (!visible) {
      setMarketInstallingId(null);
      return;
    }

    setMarketQuery('');
    setProjectRecommendationQuery('');
    setProjectRecommendationFallbackActive(false);
    setProjectRecommendationReady(false);
    setUseProjectRecommendations(true);
    setMarketView('curated');
    setMarketIndustryId('all');
    void Promise.all([resolveAndLoadProjectRecommendations(), refreshInstalledSkills()]);
    // useEffectEvent handlers must NOT be used as effect deps; they are intentionally stable-call, unstable-identity.
    // Depend only on the state that should trigger modal bootstrap.
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (useProjectRecommendations && !marketQuery.trim() && !projectRecommendationReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSkillMarket({
        nextQuery: effectiveMarketQuery,
        nextView: marketView,
        nextIndustryId: marketIndustryId,
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
    // useEffectEvent handlers must NOT be used as effect deps; they are intentionally stable-call, unstable-identity.
    // Depend only on the state that should trigger market searching.
  }, [
    effectiveMarketQuery,
    marketIndustryId,
    marketView,
    projectRecommendationFallbackActive,
    projectRecommendationReady,
    useProjectRecommendations,
    visible,
  ]);

  const content = (
    <>
      {messageContext}
      <div className='flex flex-col gap-16px'>
        <div className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-16px'>
          <div className='flex flex-col gap-12px md:flex-row md:items-start md:justify-between'>
            <div className='min-w-0'>
              <Typography.Text className='text-14px font-semibold text-t-primary'>
                {t('conversation.workspace.skillMarket.title', { defaultValue: 'Skill Market' })}
              </Typography.Text>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                {t('conversation.workspace.skillMarket.description', {
                  defaultValue:
                    'Discover remote skills and install them directly into the current workspace skill library.',
                })}
              </Typography.Paragraph>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                {t('conversation.workspace.skillMarket.workspaceLabel', {
                  workspace: workspaceDisplayName,
                  defaultValue: 'Workspace: {{workspace}}',
                })}
              </Typography.Paragraph>
              <Typography.Paragraph className='mb-0 mt-4px break-all text-t-secondary'>
                {t('conversation.workspace.skillMarket.installPathHint', {
                  path: automationPaths.skillsDir,
                  defaultValue: 'Install target: {{path}}',
                })}
              </Typography.Paragraph>
              <Typography.Paragraph className='mb-0 mt-4px text-t-secondary'>
                {t('conversation.workspace.skillMarket.catalogLabel', {
                  brand: marketBrandName,
                  defaultValue: '{{brand}} remote catalog',
                })}
              </Typography.Paragraph>
            </div>
            <div className='flex flex-wrap items-center gap-8px'>
              <Button
                type={useProjectRecommendations && !marketQuery.trim() ? 'primary' : 'secondary'}
                onClick={() => {
                  setMarketQuery('');
                  setUseProjectRecommendations(true);
                  setMarketView('curated');
                }}
              >
                {t('conversation.workspace.skillMarket.projectRecommendations', { defaultValue: 'Project Match' })}
              </Button>
              <Button
                type={!useProjectRecommendations && marketView === 'curated' ? 'primary' : 'secondary'}
                onClick={() => {
                  setUseProjectRecommendations(false);
                  setMarketView('curated');
                }}
              >
                {t('conversation.workspace.skillMarket.curatedView', { defaultValue: 'Curated' })}
              </Button>
              <Button
                type={!useProjectRecommendations && marketView === 'full' ? 'primary' : 'secondary'}
                onClick={() => {
                  setUseProjectRecommendations(false);
                  setMarketView('full');
                }}
              >
                {t('conversation.workspace.skillMarket.fullView', { defaultValue: 'Full Library' })}
              </Button>
              <Button
                type='secondary'
                icon={<Refresh size={14} className={marketRefreshing ? 'animate-spin' : ''} />}
                onClick={() => void loadSkillMarket({ forceRefresh: true, nextQuery: effectiveMarketQuery })}
              >
                {t('common.refresh', { defaultValue: 'Refresh' })}
              </Button>
              <Button type='outline' onClick={() => void ipcBridge.shell.openExternal.invoke(marketSiteUrl)}>
                {t('common.website', { defaultValue: 'Website' })}
              </Button>
            </div>
          </div>
          <div className='mt-16px'>
            <Input
              prefix={<Search />}
              value={marketQuery}
              placeholder={t('conversation.workspace.skillMarket.searchPlaceholder', {
                defaultValue: 'Search project skills...',
              })}
              onChange={(value) => {
                setMarketQuery(value);
                if (value.trim()) {
                  setUseProjectRecommendations(false);
                }
              }}
            />
          </div>
          {useProjectRecommendations && projectRecommendationQuery ? (
            <Typography.Paragraph className='mb-0 mt-8px text-12px text-t-tertiary'>
              {t('conversation.workspace.skillMarket.projectSignals', {
                query: projectRecommendationQuery,
                defaultValue: 'Project signals: {{query}}',
              })}
            </Typography.Paragraph>
          ) : null}
          {marketIndustries.length > 0 ? (
            <div className='mt-12px flex gap-8px overflow-x-auto pb-2px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
              <Button
                size='small'
                type={marketIndustryId === 'all' ? 'primary' : 'secondary'}
                onClick={() => setMarketIndustryId('all')}
              >
                {t('conversation.workspace.skillMarket.industryAll', { defaultValue: 'All' })}
              </Button>
              {marketIndustries.map((industry) => (
                <Button
                  key={industry.id}
                  size='small'
                  type={marketIndustryId === industry.id ? 'primary' : 'secondary'}
                  onClick={() => setMarketIndustryId(industry.id)}
                >
                  {`${industry.label} (${industry.count})`}
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        {!marketQuery.trim() && marketBundles.length > 0 ? (
          <div className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'>
            <div className='flex flex-col gap-4px'>
              <Typography.Text className='text-14px font-semibold text-t-primary'>
                {t('conversation.workspace.skillMarket.bundlesTitle', { defaultValue: 'Scenario bundles' })}
              </Typography.Text>
              <Typography.Paragraph className='mb-0 text-12px text-t-secondary'>
                {t('conversation.workspace.skillMarket.bundlesDescription', {
                  defaultValue: 'Add a focused set of market skills to the current project in one action.',
                })}
              </Typography.Paragraph>
            </div>
            <div className='mt-12px grid gap-10px md:grid-cols-2'>
              {marketBundles.slice(0, 4).map((bundle) => {
                const installableCount = bundle.skills.filter(
                  (skill) => skill.archives.length > 0 && !isMarketSkillInstalled(skill)
                ).length;
                const isInstalling = marketInstallingId === `bundle:${bundle.id}`;

                return (
                  <div
                    key={bundle.id}
                    className='rounded-12px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-12px'
                  >
                    <div className='flex h-full flex-col gap-10px'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-8px'>
                          <Typography.Text className='text-13px font-semibold text-t-primary'>
                            {bundle.title}
                          </Typography.Text>
                          <span className='rounded-[100px] bg-fill-2 px-8px py-2px text-11px text-t-secondary'>
                            {t('conversation.workspace.skillMarket.bundleSkillsCount', {
                              count: bundle.skills.length,
                              defaultValue: '{{count}} skills',
                            })}
                          </span>
                        </div>
                        <Typography.Paragraph className='mb-0 mt-6px line-clamp-2 text-12px text-t-secondary'>
                          {bundle.summary}
                        </Typography.Paragraph>
                        {bundle.steps.length > 0 ? (
                          <div className='mt-8px flex flex-wrap gap-6px'>
                            {bundle.steps.slice(0, 3).map((step, index) => (
                              <span
                                key={`${bundle.id}:${step.label}`}
                                className='rounded-[100px] bg-base px-8px py-2px text-10px text-t-secondary'
                              >
                                {`${index + 1}. ${step.label}`}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className='flex items-center justify-between gap-8px'>
                        <Typography.Text className='text-11px text-t-tertiary'>
                          {t('conversation.workspace.skillMarket.bundleInstallableCount', {
                            count: installableCount,
                            defaultValue: '{{count}} available',
                          })}
                        </Typography.Text>
                        <Button
                          size='small'
                          type='primary'
                          disabled={installableCount === 0}
                          loading={isInstalling}
                          onClick={() => void handleInstallBundle(bundle)}
                        >
                          {t('conversation.workspace.skillMarket.bundleInstall', { defaultValue: 'Add Bundle' })}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'>
          {marketLoading ? (
            <div className='py-24px text-center text-12px text-t-secondary'>{t('common.loading')}</div>
          ) : marketSkills.length > 0 ? (
            <div className='flex flex-col gap-12px'>
              {marketSkills.map((skill) => {
                const installed = isMarketSkillInstalled(skill);

                return (
                  <div
                    key={skill.id}
                    className='rounded-12px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-16px'
                  >
                    <div className='flex flex-col gap-10px md:flex-row md:items-start md:justify-between'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-8px'>
                          <Typography.Text className='text-14px font-semibold text-t-primary'>
                            {resolveSkillTitle(skill)}
                          </Typography.Text>
                          {installed ? (
                            <span className='rounded-[100px] bg-fill-2 px-8px py-2px text-11px text-t-secondary'>
                              {t('conversation.workspace.skillMarket.installedTag', { defaultValue: 'Installed' })}
                            </span>
                          ) : null}
                        </div>
                        <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                          {skill.description}
                        </Typography.Paragraph>
                        {skill.themes.length > 0 ? (
                          <Typography.Paragraph className='mb-0 mt-8px text-12px text-t-tertiary'>
                            {skill.themes.join(' · ')}
                          </Typography.Paragraph>
                        ) : null}
                      </div>
                      <div className='flex shrink-0 items-center gap-8px'>
                        <Button
                          type={installed ? 'secondary' : 'primary'}
                          disabled={installed}
                          loading={marketInstallingId === skill.id}
                          onClick={() => void handleInstallSkill(skill)}
                        >
                          {installed
                            ? t('conversation.workspace.skillMarket.installedTag', { defaultValue: 'Installed' })
                            : t('conversation.workspace.skillMarket.install', { defaultValue: 'Add to Project' })}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {hasMoreMarketSkills ? (
                <div className='flex justify-center'>
                  <Button
                    type='secondary'
                    loading={marketLoadingMore}
                    onClick={() => void loadSkillMarket({ append: true, nextOffset: marketSkills.length })}
                  >
                    {t('conversation.workspace.skillMarket.loadMore', { defaultValue: 'Load More' })}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className='py-24px text-center text-12px text-t-secondary'>
              {t('conversation.workspace.skillMarket.empty', {
                defaultValue: 'No matching skills were found for this project.',
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );

  if (variant === 'embedded') {
    return visible ? content : null;
  }

  return (
    <SettingsSubModal
      visible={visible}
      title={t('conversation.workspace.skillMarket.title', { defaultValue: 'Skill Market' })}
      onCancel={onClose}
      footer={null}
      unmountOnExit
      style={{ width: 'min(980px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '12px 24px 24px', maxHeight: 'min(82vh, 900px)', overflow: 'auto' }}
    >
      {content}
    </SettingsSubModal>
  );
};

export default ProjectSkillMarketModal;
