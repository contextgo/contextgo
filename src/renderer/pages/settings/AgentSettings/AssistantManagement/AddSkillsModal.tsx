import { ipcBridge } from '@/common';
import type { AddableSkill, ExternalSource, SkillMarketItem } from './types';
import { Button, Input, Modal, Typography } from '@arco-design/web-react';
import { Plus, Refresh, Search } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type AddSkillsModalProps = {
  visible: boolean;
  onCancel: () => void;
  browseMode: 'skill-market' | 'external';
  setBrowseMode: (mode: 'skill-market' | 'external') => void;

  // External sources
  externalSources: ExternalSource[];
  activeSourceTab: string;
  setActiveSourceTab: (value: string) => void;
  activeSource: ExternalSource | undefined;
  filteredExternalSkills: ExternalSource['skills'];
  externalSkillsLoading: boolean;
  searchExternalQuery: string;
  setSearchExternalQuery: (value: string) => void;
  refreshing: boolean;
  handleRefreshExternal: () => Promise<void>;
  setShowAddPathModal: (value: boolean) => void;

  // Skill Market
  marketSkills: SkillMarketItem[];
  marketQuery: string;
  setMarketQuery: (value: string) => void;
  marketLoading: boolean;
  marketLoadingMore: boolean;
  marketRefreshing: boolean;
  marketTotal: number;
  marketTotalAvailable: number;
  marketSiteUrl: string;
  hasMoreMarketSkills: boolean;
  handleRefreshSkillMarket: () => Promise<void>;
  handleLoadMoreSkillMarket: () => Promise<void>;

  // Already added skills
  customSkills: string[];

  // Add handler
  handleAddFoundSkills: (skills: AddableSkill[]) => void;
};

const AddSkillsModal: React.FC<AddSkillsModalProps> = ({
  visible,
  onCancel,
  browseMode,
  setBrowseMode,
  externalSources,
  activeSourceTab,
  setActiveSourceTab,
  activeSource,
  filteredExternalSkills,
  externalSkillsLoading,
  searchExternalQuery,
  setSearchExternalQuery,
  refreshing,
  handleRefreshExternal,
  setShowAddPathModal,
  marketSkills,
  marketQuery,
  setMarketQuery,
  marketLoading,
  marketLoadingMore,
  marketRefreshing,
  marketTotal,
  marketTotalAvailable,
  marketSiteUrl,
  hasMoreMarketSkills,
  handleRefreshSkillMarket,
  handleLoadMoreSkillMarket,
  customSkills,
  handleAddFoundSkills,
}) => {
  const { t } = useTranslation();
  const showMarket = browseMode === 'skill-market';

  return (
    <Modal
      visible={visible}
      onCancel={onCancel}
      footer={null}
      title={t('settings.addSkillsTitle', { defaultValue: 'Add Skills' })}
      className='w-[90vw] md:w-[680px]'
      wrapStyle={{ zIndex: 2500 }}
      maskStyle={{ zIndex: 2490 }}
      autoFocus={false}
    >
      <div className='flex h-[560px] flex-col gap-12px'>
        <div className='flex items-center justify-between gap-12px'>
          <div className='flex items-center gap-8px'>
            <Button
              size='small'
              type={showMarket ? 'primary' : 'secondary'}
              className='rounded-[100px]'
              onClick={() => setBrowseMode('skill-market')}
            >
              {t('settings.skillsHub.marketTitle', { defaultValue: 'Skill Market' })}
            </Button>
            <Button
              size='small'
              type={showMarket ? 'secondary' : 'primary'}
              className='rounded-[100px]'
              onClick={() => setBrowseMode('external')}
            >
              {t('settings.skillsHub.discoveredTitle', { defaultValue: 'Discovered External Skills' })}
            </Button>
          </div>
          <div className='flex items-center gap-8px'>
            <Button
              size='mini'
              type='text'
              icon={
                <Refresh
                  theme='outline'
                  size={16}
                  className={showMarket ? (marketRefreshing ? 'animate-spin' : '') : refreshing ? 'animate-spin' : ''}
                />
              }
              onClick={() => {
                if (showMarket) {
                  void handleRefreshSkillMarket();
                } else {
                  void handleRefreshExternal();
                }
              }}
            />
            {!showMarket && (
              <Button
                size='mini'
                type='outline'
                icon={<Plus size={14} />}
                className='rounded-[100px]'
                onClick={() => setShowAddPathModal(true)}
              >
                {t('settings.skillsHub.addCustomPath', { defaultValue: 'Add Custom Skill Path' })}
              </Button>
            )}
          </div>
        </div>

        {showMarket ? (
          <div className='rounded-12px border border-border-1 bg-fill-1 p-12px'>
            <div className='flex items-start justify-between gap-12px'>
              <div>
                <Typography.Text className='text-13px font-medium text-t-primary'>
                  {t('settings.skillsHub.marketDescription', {
                    defaultValue: 'Search the remote skill catalog and add packages to this assistant.',
                  })}
                </Typography.Text>
                <Typography.Paragraph className='mb-0 mt-6px text-12px text-t-secondary'>
                  {`${marketTotal} / ${marketTotalAvailable}`}
                </Typography.Paragraph>
              </div>
              <Button
                size='small'
                type='text'
                className='rounded-[100px]'
                onClick={() => void ipcBridge.shell.openExternal.invoke(marketSiteUrl)}
              >
                {t('common.website', { defaultValue: 'Website' })}
              </Button>
            </div>
          </div>
        ) : null}

        {!showMarket && externalSources.length > 0 ? (
          <div className='flex gap-8px overflow-x-auto custom-scrollbar pb-4px'>
            {externalSources.map((source) => (
              <Button
                key={source.source}
                size='small'
                type={activeSourceTab === source.source ? 'primary' : 'secondary'}
                className='rounded-[100px]'
                onClick={() => setActiveSourceTab(source.source)}
              >
                {`${source.name} (${source.skills.length})`}
              </Button>
            ))}
          </div>
        ) : null}

        <Input
          prefix={<Search />}
          placeholder={
            showMarket
              ? t('settings.skillsHub.marketSearchPlaceholder', {
                  defaultValue: 'Search Skill Market...',
                })
              : t('settings.skillsHub.searchPlaceholder', {
                  defaultValue: 'Search skills...',
                })
          }
          value={showMarket ? marketQuery : searchExternalQuery}
          onChange={(value) => {
            if (showMarket) {
              setMarketQuery(value);
            } else {
              setSearchExternalQuery(value);
            }
          }}
          className='shrink-0 rounded-[8px] bg-fill-2'
        />

        <div className='flex-1 overflow-y-auto rounded-8px bg-fill-1 p-12px'>
          {showMarket ? (
            marketLoading ? (
              <div className='flex h-full items-center justify-center text-t-tertiary'>
                {t('common.loading', { defaultValue: 'Please wait...' })}
              </div>
            ) : marketSkills.length > 0 ? (
              <div className='flex flex-col gap-8px'>
                {marketSkills.map((skill) => {
                  const isAdded = customSkills.includes(skill.name);
                  const canAdd = skill.archives.length > 0;

                  return (
                    <div
                      key={skill.id}
                      className='flex items-start gap-12px rounded-8px border border-transparent bg-base p-12px shadow-sm transition-colors hover:border-border-2'
                    >
                      <div className='mt-2px flex h-32px w-32px shrink-0 items-center justify-center rounded-8px border border-border-1 bg-fill-2 text-14px font-bold text-t-secondary uppercase'>
                        {skill.displayName.charAt(0)}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-8px'>
                          <div className='truncate text-14px font-medium text-t-primary'>{skill.displayName}</div>
                          {skill.version ? (
                            <span className='rounded-[100px] bg-fill-2 px-6px py-1px text-10px text-t-secondary'>
                              {`v${skill.version}`}
                            </span>
                          ) : null}
                        </div>
                        {skill.description ? (
                          <div className='mt-4px line-clamp-2 text-12px text-t-secondary' title={skill.description}>
                            {skill.description}
                          </div>
                        ) : null}
                        <div className='mt-6px text-11px text-t-tertiary'>
                          {[skill.author, skill.categories[0]].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className='shrink-0 self-center'>
                        {isAdded ? (
                          <Button
                            size='small'
                            disabled
                            className='rounded-[100px] border-none bg-fill-2 text-t-tertiary'
                          >
                            {t('settings.installed', { defaultValue: 'Installed' })}
                          </Button>
                        ) : (
                          <Button
                            size='small'
                            type='primary'
                            disabled={!canAdd}
                            className='rounded-[100px]'
                            onClick={() =>
                              handleAddFoundSkills([
                                {
                                  ...skill,
                                  source: 'skill-market',
                                },
                              ])
                            }
                          >
                            {canAdd
                              ? t('common.add', { defaultValue: 'Add' })
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
                    className='mt-4px rounded-8px'
                    onClick={() => void handleLoadMoreSkillMarket()}
                  >
                    {t('settings.skillsHub.loadMore', { defaultValue: 'Load More' })}
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className='flex h-full items-center justify-center text-t-tertiary'>
                {t('settings.skillsHub.marketEmpty', {
                  defaultValue: 'No matching skills found in Skill Market',
                })}
              </div>
            )
          ) : externalSkillsLoading ? (
            <div className='flex h-full items-center justify-center text-t-tertiary'>
              {t('common.loading', { defaultValue: 'Please wait...' })}
            </div>
          ) : activeSource ? (
            filteredExternalSkills.length > 0 ? (
              <div className='flex flex-col gap-8px'>
                {filteredExternalSkills.map((skill) => {
                  const isAdded = customSkills.includes(skill.name);

                  return (
                    <div
                      key={skill.path}
                      className='flex items-start gap-12px rounded-8px border border-transparent bg-base p-12px shadow-sm transition-colors hover:border-border-2'
                    >
                      <div className='mt-2px flex h-32px w-32px shrink-0 items-center justify-center rounded-8px border border-border-1 bg-fill-2 text-14px font-bold text-t-secondary uppercase'>
                        {skill.name.charAt(0)}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <div className='truncate text-14px font-medium text-t-primary'>{skill.name}</div>
                        {skill.description ? (
                          <div className='mt-4px line-clamp-2 text-12px text-t-secondary' title={skill.description}>
                            {skill.description}
                          </div>
                        ) : null}
                      </div>
                      <div className='shrink-0 self-center'>
                        {isAdded ? (
                          <Button
                            size='small'
                            disabled
                            className='rounded-[100px] border-none bg-fill-2 text-t-tertiary'
                          >
                            {t('settings.installed', { defaultValue: 'Installed' })}
                          </Button>
                        ) : (
                          <Button
                            size='small'
                            type='primary'
                            className='rounded-[100px]'
                            onClick={() =>
                              handleAddFoundSkills([
                                {
                                  ...skill,
                                  source: 'external',
                                },
                              ])
                            }
                          >
                            {t('common.add', { defaultValue: 'Add' })}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className='flex h-full items-center justify-center text-t-tertiary'>
                {t('settings.skillsHub.noSearchResults', { defaultValue: 'No skills found' })}
              </div>
            )
          ) : (
            <div className='flex h-full items-center justify-center text-t-tertiary'>
              {t('settings.skillsHub.noExternalSources', {
                defaultValue: 'No external skill sources discovered',
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default AddSkillsModal;
