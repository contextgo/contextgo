/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICronJob } from '@/common/adapter/ipcBridge';
import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';
import { Button, Empty, Input, Message, Select, Spin, Tag, Typography } from '@arco-design/web-react';
import { AlarmClock, ArrowRight, Edit, Pause, Play, Refresh, Search } from '@icon-park/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import styles from './GlobalCronSettings.module.css';
import { getCronPresets } from './cronPresetUtils';
import { formatNextRun } from './cronUtils';
import CronJobDrawer from './components/CronJobDrawer';
import CronPresetLibrary from './components/CronPresetLibrary';
import { useAllCronJobs } from './useCronJobs';
import {
  filterGlobalCronJobs,
  getGlobalCronJobStatus,
  summarizeGlobalCronJobs,
  type GlobalCronJobStatus,
} from './globalCronSettingsUtils';

const statusColorMap: Record<GlobalCronJobStatus, string> = {
  active: 'green',
  paused: 'orange',
  error: 'red',
};

const GlobalCronSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messageApi, messageContext] = Message.useMessage();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<GlobalCronJobStatus | 'all'>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { jobs, loading, refetch, pauseJob, resumeJob, deleteJob, updateJob } = useAllCronJobs();

  const presets = useMemo(() => getCronPresets(t), [t]);
  const stats = useMemo(() => summarizeGlobalCronJobs(jobs), [jobs]);
  const filteredJobs = useMemo(
    () => filterGlobalCronJobs(jobs, searchQuery, statusFilter),
    [jobs, searchQuery, statusFilter]
  );
  const selectedJob = useMemo(
    () => filteredJobs.find((job) => job.id === selectedJobId) ?? jobs.find((job) => job.id === selectedJobId) ?? null,
    [filteredJobs, jobs, selectedJobId]
  );

  const statusOptions = useMemo(
    () => [
      { label: t('cron.overview.filters.allStatuses'), value: 'all' },
      { label: t('cron.status.active'), value: 'active' },
      { label: t('cron.status.paused'), value: 'paused' },
      { label: t('cron.status.error'), value: 'error' },
    ],
    [t]
  );

  const handleRefresh = async () => {
    await refetch();
  };

  const handleToggleJob = async (job: ICronJob) => {
    try {
      if (job.enabled) {
        await pauseJob(job.id);
        messageApi.success(t('cron.pauseSuccess'));
      } else {
        await resumeJob(job.id);
        messageApi.success(t('cron.resumeSuccess'));
      }
    } catch (error) {
      console.error('[GlobalCronSettings] Failed to toggle cron job:', error);
      messageApi.error(t('common.unknownError'));
    }
  };

  const handleSaveJob = async (job: ICronJob, updates: { message: string; enabled: boolean }) => {
    await updateJob(job.id, {
      enabled: updates.enabled,
      target: { payload: { kind: 'message', text: updates.message } },
    });
  };

  const handleDeleteJob = async (job: ICronJob) => {
    await deleteJob(job.id);
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
                  <h1 className={styles.pageTitle}>{t('cron.allScheduledTasks')}</h1>
                  <span className={styles.countBadge}>{stats.total}</span>
                </div>
                <p className={styles.pageDescription}>{t('cron.overview.description')}</p>
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
              <div className={styles.statLabel}>{t('cron.overview.stats.total')}</div>
              <div className={styles.statValue}>{stats.total}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('cron.overview.stats.active')}</div>
              <div className={styles.statValue}>{stats.active}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('cron.overview.stats.paused')}</div>
              <div className={styles.statValue}>{stats.paused}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>{t('cron.overview.stats.error')}</div>
              <div className={styles.statValue}>{stats.error}</div>
            </div>
          </div>

          <div className={styles.surface}>
            <div className={styles.filterRow}>
              <Input
                value={searchQuery}
                allowClear
                prefix={<Search theme='outline' size={14} />}
                placeholder={t('cron.overview.filters.searchPlaceholder')}
                onChange={setSearchQuery}
                className={styles.searchInput}
              />
              <Select
                value={statusFilter}
                options={statusOptions}
                className={styles.statusFilter}
                onChange={(value) => setStatusFilter(value as GlobalCronJobStatus | 'all')}
              />
            </div>
          </div>

          <div className={styles.surface}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionTitleRow}>
                <span className={styles.sectionIcon}>
                  <AlarmClock theme='outline' size={18} />
                </span>
                <span className={styles.sectionTitle}>{t('cron.taskCount', { count: filteredJobs.length })}</span>
              </div>
              <span className={styles.sectionMeta}>{filteredJobs.length}</span>
            </div>

            <Spin loading={loading} className='w-full'>
              {filteredJobs.length === 0 ? (
                jobs.length > 0 ? (
                  <Empty description={t('cron.overview.emptyFiltered')} className='py-24px' />
                ) : (
                  <div className='flex flex-col gap-20px'>
                    <Empty description={t('cron.overview.emptyInitial')} className='py-20px' />
                    <CronPresetLibrary presets={presets} previewOnly={true} helperText={t('cron.presets.emptyHint')} />
                  </div>
                )
              ) : (
                <div className={styles.jobList}>
                  {filteredJobs.map((job) => {
                    const status = getGlobalCronJobStatus(job);
                    return (
                      <div key={job.id} className={styles.jobCard}>
                        <div className={styles.jobCardInner}>
                          <div className='flex flex-col gap-14px md:flex-row md:items-start md:justify-between'>
                            <div className={styles.jobMain}>
                              <div className={styles.jobTitleRow}>
                                <Typography.Text className={styles.jobTitle}>{job.name}</Typography.Text>
                                <Tag color={statusColorMap[status]}>{t(`cron.status.${status}`)}</Tag>
                                <Tag>{job.metadata.agentType}</Tag>
                              </div>

                              <div className={styles.jobMetaBlock}>
                                <div className={styles.jobConversationRow}>
                                  <span className={styles.jobConversationTitle}>
                                    {job.metadata.conversationTitle || job.metadata.conversationId}
                                  </span>
                                  <span className={styles.jobConversationId}>#{job.metadata.conversationId}</span>
                                </div>

                                <div className={styles.jobDetailGrid}>
                                  <div className={styles.jobDetailItem}>
                                    <div className={styles.jobDetailLabel}>{t('cron.schedule')}</div>
                                    <div className={styles.jobDetailValue}>{job.schedule.description}</div>
                                  </div>
                                  <div className={styles.jobDetailItem}>
                                    <div className={styles.jobDetailLabel}>{t('cron.nextRun')}</div>
                                    <div className={styles.jobDetailValue}>{formatNextRun(job.state.nextRunAtMs)}</div>
                                  </div>
                                  <div className={styles.jobDetailItem}>
                                    <div className={styles.jobDetailLabel}>{t('cron.lastRun')}</div>
                                    <div className={styles.jobDetailValue}>{formatNextRun(job.state.lastRunAtMs)}</div>
                                  </div>
                                  <div className={styles.jobDetailItem}>
                                    <div className={styles.jobDetailLabel}>{t('settings.mcpStatus')}</div>
                                    <div className={styles.jobDetailValue}>{t(`cron.status.${status}`)}</div>
                                  </div>
                                </div>

                                <div className={styles.jobMessage}>
                                  <div className={styles.jobDetailLabel}>{t('cron.message')}</div>
                                  <div className={styles.jobDetailValue}>{job.target.payload.text}</div>
                                </div>

                                {job.state.lastError && (
                                  <div className={styles.jobError}>
                                    <div className={styles.jobDetailLabel}>{t('cron.lastError')}</div>
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
                                onClick={() => void navigate(`/conversation/${job.metadata.conversationId}`)}
                              >
                                {t('cron.actions.goTo')}
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
                                icon={job.enabled ? <Pause size={14} /> : <Play size={14} />}
                                onClick={() => void handleToggleJob(job)}
                              >
                                {job.enabled ? t('cron.actions.pause') : t('cron.actions.resume')}
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
        <CronJobDrawer
          visible
          job={selectedJob}
          onClose={() => setSelectedJobId(null)}
          onSave={(updates) => handleSaveJob(selectedJob, updates)}
          onDelete={() => handleDeleteJob(selectedJob)}
        />
      )}
    </>
  );
};

export default GlobalCronSettings;
