/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IContextSchedule } from '@/common/adapter/ipcBridge';
import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';
import { Button, Empty, Input, Message, Select, Spin, Tag, Typography } from '@arco-design/web-react';
import { AlarmClock, ArrowRight, Edit, Pause, Play, Refresh, Search } from '@icon-park/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from './GlobalScheduleSettings.module.css';
import { getSchedulePresets } from './schedulePresetUtils';
import {
  formatNextRun,
  getScheduleAgentType,
  getScheduleConversationId,
  getScheduleConversationTitle,
  getSchedulePrimaryText,
} from './scheduleUtils';
import ScheduleJobDrawer from './components/ScheduleJobDrawer';
import SchedulePresetLibrary from './components/SchedulePresetLibrary';
import { useAllScheduleJobs } from './useScheduleJobs';
import {
  filterGlobalScheduleJobs,
  getGlobalScheduleJobStatus,
  summarizeGlobalScheduleJobs,
  type GlobalScheduleJobStatus,
} from './globalScheduleSettingsUtils';

const statusColorMap: Record<GlobalScheduleJobStatus, string> = {
  active: 'green',
  paused: 'orange',
  error: 'red',
};

const GlobalScheduleSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messageApi, messageContext] = Message.useMessage();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GlobalScheduleJobStatus | 'all'>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { jobs, loading, refetch, pauseJob, resumeJob, runJobNow, deleteJob, updateJob } = useAllScheduleJobs();

  const presets = useMemo(() => getSchedulePresets(t), [t]);
  const stats = useMemo(() => summarizeGlobalScheduleJobs(jobs), [jobs]);
  const filteredJobs = useMemo(
    () => filterGlobalScheduleJobs(jobs, searchQuery, statusFilter),
    [jobs, searchQuery, statusFilter]
  );
  const selectedJob = useMemo(
    () => filteredJobs.find((job) => job.id === selectedJobId) ?? jobs.find((job) => job.id === selectedJobId) ?? null,
    [filteredJobs, jobs, selectedJobId]
  );

  const statusOptions = useMemo(
    () => [
      { label: t('schedule.overview.filters.allStatuses'), value: 'all' },
      { label: t('schedule.status.active'), value: 'active' },
      { label: t('schedule.status.paused'), value: 'paused' },
      { label: t('schedule.status.error'), value: 'error' },
    ],
    [t]
  );

  const handleRefresh = async () => {
    await refetch();
  };

  const handleToggleJob = async (job: IContextSchedule) => {
    try {
      if (job.enabled) {
        await pauseJob(job.id);
        messageApi.success(t('schedule.pauseSuccess'));
      } else {
        await resumeJob(job.id);
        messageApi.success(t('schedule.resumeSuccess'));
      }
    } catch (error) {
      console.error('[GlobalScheduleSettings] Failed to toggle cron job:', error);
      messageApi.error(t('common.unknownError'));
    }
  };

  const handleSaveJob = async (
    job: IContextSchedule,
    updates: { message: string; enabled: boolean; schedule?: IContextSchedule['schedule'] }
  ) => {
    await updateJob(job.id, {
      enabled: updates.enabled,
      schedule: updates.schedule,
      target:
        job.target.kind === 'send_query'
          ? {
              ...job.target,
              message: updates.message,
            }
          : {
              ...job.target,
              reason: updates.message,
            },
    });
  };

  const handleDeleteJob = async (job: IContextSchedule) => {
    await deleteJob(job.id);
  };

  const handleRunNow = async (job: IContextSchedule) => {
    try {
      await runJobNow(job.id);
      messageApi.success(t('schedule.runNowSuccess'));
    } catch (error) {
      console.error('[GlobalScheduleSettings] Failed to run schedule now:', error);
      messageApi.error(error instanceof Error ? error.message : t('common.unknownError'));
    }
  };

  return (
    <>
      {messageContext}
      <SettingsPageWrapper>
        <div className={styles.pageStack}>
          <div className={styles.heroSurface}>
            <div className={styles.heroRow}>
              <div className={styles.heroMeta}>
                <div className={styles.titleRow}>
                  <h1 className={styles.pageTitle}>{t('schedule.allScheduledTasks')}</h1>
                  <span className={styles.countBadge}>{stats.total}</span>
                </div>
                <p className={styles.pageDescription}>{t('schedule.overview.description')}</p>
              </div>
              <div className={styles.actions}>
                <Button
                  type='outline'
                  className={styles.secondaryPillButton}
                  icon={<Refresh size={14} className={loading ? 'animate-spin' : ''} />}
                  onClick={() => void handleRefresh()}
                >
                  {t('common.refresh')}
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('schedule.overview.stats.total')}</div>
              <div className={styles.statValue}>{stats.total}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('schedule.overview.stats.active')}</div>
              <div className={styles.statValue}>{stats.active}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('schedule.overview.stats.paused')}</div>
              <div className={styles.statValue}>{stats.paused}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('schedule.overview.stats.error')}</div>
              <div className={styles.statValue}>{stats.error}</div>
            </div>
          </div>

          <div className={styles.surface}>
            <div className={styles.filterRow}>
              <Input
                value={searchQuery}
                allowClear
                prefix={<Search theme='outline' size={14} />}
                placeholder={t('schedule.overview.filters.searchPlaceholder')}
                onChange={setSearchQuery}
                className={styles.searchInput}
              />
              <Select
                value={statusFilter}
                options={statusOptions}
                className={styles.statusFilter}
                onChange={(value) => setStatusFilter(value as GlobalScheduleJobStatus | 'all')}
              />
            </div>
          </div>

          <div className={styles.surface}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleRow}>
                <span className={styles.sectionIcon}>
                  <AlarmClock theme='outline' size={18} />
                </span>
                <span className={styles.sectionTitle}>{t('schedule.taskCount', { count: filteredJobs.length })}</span>
              </div>
              <span className={styles.sectionMeta}>{filteredJobs.length}</span>
            </div>

            <Spin loading={loading} className='w-full'>
              {filteredJobs.length === 0 ? (
                jobs.length > 0 ? (
                  <Empty description={t('schedule.overview.emptyFiltered')} className='py-24px' />
                ) : (
                  <div className='flex flex-col gap-20px'>
                    <Empty description={t('schedule.overview.emptyInitial')} className='py-20px' />
                    <SchedulePresetLibrary
                      presets={presets}
                      previewOnly={true}
                      helperText={t('schedule.presets.emptyHint')}
                    />
                  </div>
                )
              ) : (
                <div className={styles.jobList}>
                  {filteredJobs.map((job) => {
                    const status = getGlobalScheduleJobStatus(job);
                    return (
                      <div key={job.id} className={styles.jobCard}>
                        <div className={styles.jobCardInner}>
                          <div className='flex flex-col gap-14px md:flex-row md:items-start md:justify-between'>
                            <div className={styles.jobMain}>
                              <div className={styles.jobTitleRow}>
                                <Typography.Text className={styles.jobTitle}>{job.name}</Typography.Text>
                                <Tag color={statusColorMap[status]}>{t(`schedule.status.${status}`)}</Tag>
                                <Tag>{job.target.kind}</Tag>
                                {getScheduleAgentType(job) ? <Tag>{getScheduleAgentType(job)}</Tag> : null}
                              </div>

                              <div className={styles.jobMetaBlock}>
                                <div className={styles.jobConversationRow}>
                                  <span className={styles.jobConversationTitle}>
                                    {getScheduleConversationTitle(job) || job.scope.projectSlug || job.scope.spaceId}
                                  </span>
                                  {getScheduleConversationId(job) ? (
                                    <span className={styles.jobConversationId}>#{getScheduleConversationId(job)}</span>
                                  ) : null}
                                </div>

                                <div className={styles.jobDetailGrid}>
                                  <div className={styles.jobDetailItem}>
                                    <div className={styles.jobDetailLabel}>{t('schedule.schedule')}</div>
                                    <div className={styles.jobDetailValue}>{job.schedule.description}</div>
                                  </div>
                                  <div className={styles.jobDetailItem}>
                                    <div className={styles.jobDetailLabel}>{t('schedule.nextRun')}</div>
                                    <div className={styles.jobDetailValue}>{formatNextRun(job.state.nextRunAtMs)}</div>
                                  </div>
                                  <div className={styles.jobDetailItem}>
                                    <div className={styles.jobDetailLabel}>{t('schedule.lastRun')}</div>
                                    <div className={styles.jobDetailValue}>{formatNextRun(job.state.lastRunAtMs)}</div>
                                  </div>
                                  <div className={styles.jobDetailItem}>
                                    <div className={styles.jobDetailLabel}>{t('settings.mcpStatus')}</div>
                                    <div className={styles.jobDetailValue}>{t(`schedule.status.${status}`)}</div>
                                  </div>
                                </div>

                                <div className={styles.jobMessage}>
                                  <div className={styles.jobDetailLabel}>{t('schedule.message')}</div>
                                  <div className={styles.jobDetailValue}>{getSchedulePrimaryText(job)}</div>
                                </div>

                                {job.state.lastError && (
                                  <div className={styles.jobError}>
                                    <div className={styles.jobDetailLabel}>{t('schedule.lastError')}</div>
                                    <div className={styles.jobDetailValue}>{job.state.lastError}</div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className={styles.jobActions}>
                              <Button
                                type='outline'
                                className={styles.secondaryPillButton}
                                icon={<ArrowRight size={14} />}
                                disabled={!getScheduleConversationId(job)}
                                onClick={() => {
                                  const conversationId = getScheduleConversationId(job);
                                  if (conversationId) {
                                    void navigate(`/conversation/${conversationId}`);
                                  }
                                }}
                              >
                                {t('schedule.actions.goTo')}
                              </Button>
                              <Button
                                type='outline'
                                className={styles.secondaryPillButton}
                                icon={<Edit size={14} />}
                                onClick={() => setSelectedJobId(job.id)}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                type='outline'
                                className={styles.secondaryPillButton}
                                icon={<Play size={14} />}
                                onClick={() => void handleRunNow(job)}
                              >
                                {t('schedule.actions.runNow')}
                              </Button>
                              <Button
                                type='outline'
                                className={styles.secondaryPillButton}
                                icon={job.enabled ? <Pause size={14} /> : <Play size={14} />}
                                onClick={() => void handleToggleJob(job)}
                              >
                                {job.enabled ? t('schedule.actions.pause') : t('schedule.actions.resume')}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Spin>
          </div>
        </div>
      </SettingsPageWrapper>

      {selectedJob && (
        <ScheduleJobDrawer
          visible
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onSave={(updates) => handleSaveJob(selectedJob, updates)}
          onRunNow={() => handleRunNow(selectedJob)}
          onDelete={() => handleDeleteJob(selectedJob)}
        />
      )}
    </>
  );
};

export default GlobalScheduleSettings;
