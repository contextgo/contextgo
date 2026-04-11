/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { iconColors } from '@/renderer/styles/colors';
import { emitter } from '@/renderer/utils/emitter';
import { Button, Message, Popover, Tooltip } from '@arco-design/web-react';
import { AlarmClock, Edit } from '@icon-park/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getScheduleDirectCreateContext, getSchedulePresets, type SchedulePresetId } from '../schedulePresetUtils';
import { useScheduleJobs } from '../useScheduleJobs';
import { getJobStatusFlags } from '../scheduleUtils';
import SchedulePresetLibrary from './SchedulePresetLibrary';
import styles from './ScheduleJobManager.module.css';
import ScheduleJobDrawer from './ScheduleJobDrawer';

interface ScheduleJobManagerProps {
  conversation: TChatConversation;
}

/**
 * Cron job manager component for ChatLayout headerExtra
 * Shows a single job per conversation with drawer for editing
 */
const ScheduleJobManager: React.FC<ScheduleJobManagerProps> = ({ conversation }) => {
  const { t } = useTranslation();
  const [messageApi, messageContext] = Message.useMessage();
  const conversationId = conversation.id;
  const { jobs, loading, hasJobs, deleteJob, updateJob, runJobNow } = useScheduleJobs(conversationId);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [presetPopoverVisible, setPresetPopoverVisible] = useState(false);
  const [creatingPresetId, setCreatingPresetId] = useState<SchedulePresetId | null>(null);

  const presets = useMemo(() => getSchedulePresets(t), [t]);
  const directCreateContext = useMemo(() => getScheduleDirectCreateContext(conversation), [conversation]);

  const handleCreateClick = () => {
    emitter.emit('sendbox.fill', t('schedule.status.defaultPrompt'));
    setPresetPopoverVisible(false);
  };

  const handleFillPreset = (prompt: string) => {
    emitter.emit('sendbox.fill', prompt);
    setPresetPopoverVisible(false);
  };

  const handleCreatePreset = async (preset: ReturnType<typeof getSchedulePresets>[number]) => {
    if (!directCreateContext) {
      handleFillPreset(preset.prompt);
      return;
    }

    setCreatingPresetId(preset.id);
    try {
      await ipcBridge.schedule.createConversationSchedule.invoke({
        name: preset.name,
        schedule: {
          kind: 'cron',
          expr: preset.schedule.expr,
          description: preset.schedule.description,
        },
        message: preset.message,
        conversationId: directCreateContext.conversationId,
        conversationTitle: directCreateContext.conversationTitle,
        workspacePath: directCreateContext.workspacePath,
        agentType: directCreateContext.agentType,
        createdBy: 'user',
      });

      messageApi.success(t('schedule.presets.createSuccess', { name: preset.name }));
      setPresetPopoverVisible(false);
    } catch (error) {
      if (error instanceof Error) {
        messageApi.error(error.message);
      } else {
        messageApi.error(t('common.unknownError'));
      }
    } finally {
      setCreatingPresetId(null);
    }
  };

  // Handle unconfigured state (no jobs)
  if (!hasJobs && !loading) {
    return (
      <>
        {messageContext}
        <Popover
          className={styles.presetPopover}
          trigger='click'
          position='bottom'
          popupVisible={presetPopoverVisible}
          onVisibleChange={setPresetPopoverVisible}
          content={
            <div className={styles.presetPopoverShell}>
              <div className={styles.presetPopoverScrollArea}>
                <SchedulePresetLibrary
                  presets={presets}
                  creatingPresetId={creatingPresetId}
                  helperText={t(
                    directCreateContext ? 'schedule.presets.directCreateHint' : 'schedule.presets.fillOnlyHint'
                  )}
                  onCreatePreset={directCreateContext ? (preset) => void handleCreatePreset(preset) : undefined}
                  onFillPreset={(preset) => handleFillPreset(preset.prompt)}
                />
              </div>

              <div className={styles.presetPopoverFooter}>
                <Button
                  type='primary'
                  className={`${styles.presetPopoverAction} ${styles.presetPopoverPrimaryAction}`}
                  icon={<Edit theme='outline' size={14} />}
                  onClick={handleCreateClick}
                >
                  {t('schedule.presets.actions.customize')}
                </Button>
              </div>
            </div>
          }
        >
          <Button
            type='text'
            size='small'
            className='app-header-pill-button schedule-job-manager-button chat-header-schedule-pill !h-auto !w-auto !min-w-0'
          >
            <span className='app-header-pill app-header-pill--status'>
              <span className='app-header-pill__icon'>
                <AlarmClock theme='outline' size={16} fill={iconColors.disabled} />
              </span>
              <span className='app-header-pill__dot bg-[rgb(var(--gray-6))]' />
            </span>
          </Button>
        </Popover>
      </>
    );
  }

  // Don't render anything while loading
  if (loading) {
    return null;
  }

  // Get the single job (assuming one job per conversation)
  const job = jobs[0];
  if (!job) return null;

  const { hasError, isPaused } = getJobStatusFlags(job);

  const tooltipContent = isPaused ? t('schedule.status.paused') : hasError ? t('schedule.status.error') : job.name;

  const handleSave = async (updates: { message: string; enabled: boolean; schedule?: (typeof job)['schedule'] }) => {
    await updateJob(job.id, {
      enabled: updates.enabled,
      schedule: updates.schedule,
      target:
        job.target.kind === 'send_query'
          ? {
              ...job.target,
              message: updates.message,
            }
          : job.target,
    });
  };

  const handleDelete = async () => {
    await deleteJob(job.id);
  };

  const handleRunNow = async () => {
    await runJobNow(job.id);
  };

  return (
    <>
      {messageContext}
      <Tooltip content={tooltipContent}>
        <Button
          type='text'
          size='small'
          className='app-header-pill-button schedule-job-manager-button chat-header-schedule-pill !h-auto !w-auto !min-w-0'
          onClick={() => setDrawerVisible(true)}
        >
          <span className='app-header-pill app-header-pill--status'>
            <span className='app-header-pill__icon'>
              <AlarmClock theme='outline' size={16} fill={iconColors.primary} />
            </span>
            <span
              className={`app-header-pill__dot ${hasError ? 'bg-[rgb(var(--danger-6))]' : isPaused ? 'bg-[rgb(var(--warning-6))]' : 'bg-[rgb(var(--success-6))]'}`}
            />
          </span>
        </Button>
      </Tooltip>
      <ScheduleJobDrawer
        visible={drawerVisible}
        job={job}
        onClose={() => setDrawerVisible(false)}
        onSave={handleSave}
        onRunNow={handleRunNow}
        onDelete={handleDelete}
      />
    </>
  );
};

export default ScheduleJobManager;
