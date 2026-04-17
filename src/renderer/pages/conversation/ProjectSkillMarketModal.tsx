import { ipcBridge } from '@/common';
import { SettingsSubModal } from '@/renderer/components/settings';
import type {
  SkillInfo,
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
  const [marketView, setMarketView] = useState<SkillMarketView>('curated');
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);
  const [marketRefreshing, setMarketRefreshing] = useState(false);
  const [marketTotal, setMarketTotal] = useState(0);
  const [marketBrandName, setMarketBrandName] = useState('ContextGo');
  const [marketSiteUrl, setMarketSiteUrl] = useState('https://www.skillmarket.com.cn');
  const [marketInstallingId, setMarketInstallingId] = useState<string | null>(null);
  const [installedSkillNames, setInstalledSkillNames] = useState<Set<string>>(new Set());

  const automationPaths = useMemo(() => getWorkspaceAutomationPaths(workspacePath), [workspacePath]);
  const workspaceDisplayName = useMemo(() => getWorkspaceDisplayName(workspacePath, t), [workspacePath, t]);
  const hasMoreMarketSkills = marketSkills.length < marketTotal;

  const refreshInstalledSkills = useEffectEvent(async () => {
    const skills = await ipcBridge.fs.listAvailableSkills.invoke({ workspacePath });
    setInstalledSkillNames(resolveWorkspaceInstalledSkillNames(skills, automationPaths.skillsDir));
  });

  const loadSkillMarket = useEffectEvent(
    async ({
      append = false,
      forceRefresh = false,
      nextQuery,
      nextView,
      nextOffset,
    }: {
      append?: boolean;
      forceRefresh?: boolean;
      nextQuery?: string;
      nextView?: SkillMarketView;
      nextOffset?: number;
    } = {}) => {
      const query = nextQuery ?? marketQuery;
      const view = nextView ?? marketView;
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
          limit: 12,
          offset,
          forceRefresh,
          view,
        });

        if (!response.success || !response.data) {
          messageApi.error(
            response.msg ||
              t('conversation.workspace.skillMarket.loadFailed', {
                defaultValue: 'Failed to load project Skill Market',
              })
          );
          return;
        }

        setMarketSkills((current) => (append ? [...current, ...response.data.items] : response.data.items));
        setMarketTotal(response.data.total);
        setMarketBrandName(response.data.brandName);
        setMarketSiteUrl(response.data.siteUrl);
      } catch (error) {
        console.error('Failed to load project Skill Market:', error);
        messageApi.error(
          t('conversation.workspace.skillMarket.loadFailed', {
            defaultValue: 'Failed to load project Skill Market',
          })
        );
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

  useEffect(() => {
    if (!visible) {
      setMarketInstallingId(null);
      return;
    }

    setMarketQuery('');
    setMarketView('curated');
    void Promise.all([loadSkillMarket({ nextQuery: '', nextView: 'curated' }), refreshInstalledSkills()]);
    // useEffectEvent handlers must NOT be used as effect deps; they are intentionally stable-call, unstable-identity.
    // Depend only on the state that should trigger modal bootstrap.
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSkillMarket({ nextQuery: marketQuery, nextView: marketView });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
    // useEffectEvent handlers must NOT be used as effect deps; they are intentionally stable-call, unstable-identity.
    // Depend only on the state that should trigger market searching.
  }, [marketQuery, marketView, visible]);

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
                type={marketView === 'curated' ? 'primary' : 'secondary'}
                onClick={() => setMarketView('curated')}
              >
                {t('conversation.workspace.skillMarket.curatedView', { defaultValue: 'Curated' })}
              </Button>
              <Button type={marketView === 'full' ? 'primary' : 'secondary'} onClick={() => setMarketView('full')}>
                {t('conversation.workspace.skillMarket.fullView', { defaultValue: 'Full Library' })}
              </Button>
              <Button
                type='secondary'
                icon={<Refresh size={14} className={marketRefreshing ? 'animate-spin' : ''} />}
                onClick={() => void loadSkillMarket({ forceRefresh: true })}
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
              onChange={(value) => setMarketQuery(value)}
            />
          </div>
        </div>

        <div className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'>
          {marketLoading ? (
            <div className='py-24px text-center text-12px text-t-secondary'>{t('common.loading')}</div>
          ) : marketSkills.length > 0 ? (
            <div className='flex flex-col gap-12px'>
              {marketSkills.map((skill) => {
                const installed =
                  installedSkillNames.has(skill.name) || installedSkillNames.has(skill.displayName || skill.name);

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
