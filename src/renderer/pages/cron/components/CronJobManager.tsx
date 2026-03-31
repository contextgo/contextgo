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
import { AlarmClock } from '@icon-park/react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCronDirectCreateContext, getCronPresets, type CronPresetId } from '../cronPresetUtils';
import { useCronJobs } from '../useCronJobs';
import { getJobStatusFlags } from '../cronUtils';
import CronPresetLibrary from './CronPresetLibrary';
import styles from './CronJobManager.module.css';
import CronJobDrawer from './CronJobDrawer';

interface CronJobManagerProps {
  conversation: TChatConversation;
}

/**
 * Cron job manager component for ChatLayout headerExtra
 * Shows a single job per conversation with drawer for editing
 */
const CronJobManager: React.FC<CronJobManagerProps> = ({ conversation }) => {
  const { t } = useTranslation();
  const [messageApi, messageContext] = Message.useMessage();
  const conversationId = conversation.id;
  const { jobs, loading, hasJobs, deleteJob, updateJob } = useCronJobs(conversationId);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [presetPopoverVisible, setPresetPopoverVisible] = useState(false);
  const [creatingPresetId, setCreatingPresetId] = useState<CronPresetId | null>(null);

  const presets = useMemo(() => getCronPresets(t), [t]);
  const directCreateContext = useMemo(() => getCronDirectCreateContext(conversation), [conversation]);

  const handleCreateClick = () => {
    emitter.emit('sendbox.fill', t('cron.status.defaultPrompt'));
    setPresetPopoverVisible(false);
  };

  const handleFillPreset = (prompt: string) => {
    emitter.emit('sendbox.fill', prompt);
    setPresetPopoverVisible(false);
  };

  const handleCreatePreset = async (preset: ReturnType<typeof getCronPresets>[number]) => {
    if (!directCreateContext) {
      handleFillPreset(preset.prompt);
      return;
    }

    setCreatingPresetId(preset.id);
    try {
      await ipcBridge.cron.addJob.invoke({
        name: preset.name,
        schedule: {
          kind: 'cron',
          expr: preset.schedule.expr,
          description: preset.schedule.description,
        },
        message: preset.message,
        conversationId: directCreateContext.conversationId,
        conversationTitle: directCreateContext.conversationTitle,
        agentType: directCreateContext.agentType,
        createdBy: 'user',
      });

      messageApi.success(t('cron.presets.createSuccess', { name: preset.name }));
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
                <CronPresetLibrary
                  presets={presets}
                  creatingPresetId={creatingPresetId}
                  helperText={t(directCreateContext ? 'cron.presets.directCreateHint' : 'cron.presets.fillOnlyHint')}
                  onCreatePreset={directCreateContext ? (preset) => void handleCreatePreset(preset) : undefined}
                  onFillPreset={(preset) => handleFillPreset(preset.prompt)}
                />
              </div>

              <Button className={styles.presetPopoverAction} size='mini' onClick={handleCreateClick}>
                {t('cron.presets.actions.customize')}
              </Button>
            </div>
          }
        >
          <Button
            type='text'
            size='small'
            className='cron-job-manager-button chat-header-cron-pill !h-auto !w-auto !min-w-0 !px-0 !py-0'
          >
            <span className='inline-flex items-center gap-2px rounded-full px-8px py-2px bg-2'>
              <AlarmClock theme='outline' size={16} fill={iconColors.disabled} />
              <span className='ml-4px h-8px w-8px rounded-full bg-[rgb(var(--gray-6))]' />
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

  const tooltipContent = isPaused ? t('cron.status.paused') : hasError ? t('cron.status.error') : job.name;

  const handleSave = async (updates: { message: string; enabled: boolean }) => {
    await updateJob(job.id, {
      enabled: updates.enabled,
      target: { payload: { kind: 'message', text: updates.message } },
    });
  };

  const handleDelete = async () => {
    await deleteJob(job.id);
  };

  return (
    <>
      {messageContext}
      <Tooltip content={tooltipContent}>
        <Button
          type='text'
          size='small'
          className='cron-job-manager-button chat-header-cron-pill !h-auto !w-auto !min-w-0 !px-0 !py-0'
          onClick={() => setDrawerVisible(true)}
        >
          <span className='inline-flex items-center gap-2px rounded-full px-8px py-2px bg-2'>
            <AlarmClock theme='outline' size={16} fill={iconColors.primary} />
            <span
              className={`ml-4px h-8px w-8px rounded-full ${hasError ? 'bg-[rgb(var(--danger-6))]' : isPaused ? 'bg-[rgb(var(--warning-6))]' : 'bg-[rgb(var(--success-6))]'}`}
            />
          </span>
        </Button>
      </Tooltip>
      <CronJobDrawer
        visible={drawerVisible}
        job={job}
        onClose={() => setDrawerVisible(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </>
  );
};

export default CronJobManager;
