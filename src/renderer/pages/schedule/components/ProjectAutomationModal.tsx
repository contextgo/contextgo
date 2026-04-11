/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { normalizeManagedSlashCommandLibrary, type ManagedSlashCommandRecord } from '@/common/chat/slash/library';
import type { IContextSchedule, IScheduleSpec } from '@/common/adapter/ipcBridge';
import type { TChatConversation } from '@/common/config/storage';
import { SettingsSubModal } from '@/renderer/components/settings';
import ManagedCommandLibraryEditor from '@/renderer/pages/settings/ToolsSettings/ManagedCommandLibraryEditor';
import { emitter } from '@/renderer/utils/emitter';
import { getWorkspaceAutomationPaths } from '@/renderer/utils/workspace/workspace';
import { Button, Input, Message, Switch, Tag, Typography } from '@arco-design/web-react';
import { Delete, FolderOpen, Play } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNextRun, getJobStatusFlags } from '../scheduleUtils';
import { getScheduleDirectCreateContext } from '../schedulePresetUtils';
import { useScheduleJobs } from '../useScheduleJobs';

type ProjectAutomationModalProps = {
  visible: boolean;
  conversation: TChatConversation;
  onClose: () => void;
};

type ProjectScheduleEditorState = {
  name: string;
  enabled: boolean;
  message: string;
  cronExpr: string;
  scheduleDescription: string;
};

const EMPTY_SCHEDULE_EDITOR_STATE: ProjectScheduleEditorState = {
  name: '',
  enabled: true,
  message: '',
  cronExpr: '',
  scheduleDescription: '',
};

function isMissingWorkspaceFileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ENOENT|no such file or directory|not found/i.test(message);
}

function createScheduleEditorState(job?: IContextSchedule | null): ProjectScheduleEditorState {
  if (!job) {
    return EMPTY_SCHEDULE_EDITOR_STATE;
  }

  return {
    name: job.name,
    enabled: job.enabled,
    message: job.target.kind === 'send_query' ? job.target.message : job.target.reason,
    cronExpr: job.schedule.kind === 'cron' ? job.schedule.expr : '',
    scheduleDescription: job.schedule.description,
  };
}

const ProjectAutomationModal: React.FC<ProjectAutomationModalProps> = ({ visible, conversation, onClose }) => {
  const { t } = useTranslation();
  const [messageApi, messageContext] = Message.useMessage();
  const [revealingTarget, setRevealingTarget] = useState<string | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleDeleting, setScheduleDeleting] = useState(false);
  const [scheduleRunningNow, setScheduleRunningNow] = useState(false);
  const directCreateContext = useMemo(() => getScheduleDirectCreateContext(conversation), [conversation]);
  const automationPaths = useMemo(() => {
    const workspacePath = conversation.extra?.workingDirectory || conversation.extra?.workspace;
    return workspacePath ? getWorkspaceAutomationPaths(workspacePath) : null;
  }, [conversation.extra?.workingDirectory, conversation.extra?.workspace]);
  const { jobs, loading, updateJob, deleteJob, runJobNow } = useScheduleJobs(conversation.id);
  const existingJob = jobs[0] ?? null;
  const [scheduleState, setScheduleState] = useState<ProjectScheduleEditorState>(EMPTY_SCHEDULE_EDITOR_STATE);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setScheduleState(createScheduleEditorState(existingJob));
  }, [existingJob, visible]);

  const revealTarget = useCallback(
    async (targetPath: string) => {
      setRevealingTarget(targetPath);
      try {
        await ipcBridge.shell.revealPath.invoke(targetPath);
      } catch (error) {
        messageApi.error(error instanceof Error ? error.message : t('common.unknownError'));
      } finally {
        setRevealingTarget(null);
      }
    },
    [messageApi, t]
  );

  const loadProjectCommandLibrary = useCallback(async (): Promise<ManagedSlashCommandRecord[]> => {
    if (!automationPaths) {
      return [];
    }

    try {
      const raw = await ipcBridge.fs.readFile.invoke({ path: automationPaths.commandsFile });
      return normalizeManagedSlashCommandLibrary(JSON.parse(raw));
    } catch (error) {
      if (!isMissingWorkspaceFileError(error)) {
        throw error;
      }

      const response = await ipcBridge.conversation.getSlashCommands.invoke({
        conversation_id: conversation.id,
        includeRuntimeCommands: false,
      });

      if (!response.success || !response.data?.managedLibrary) {
        throw new Error(response.msg || t('settings.commands.loadFailed'), { cause: error });
      }

      return normalizeManagedSlashCommandLibrary(response.data.managedLibrary);
    }
  }, [automationPaths, conversation.id, t]);

  const saveProjectCommandLibrary = useCallback(
    async (nextLibrary: ManagedSlashCommandRecord[]) => {
      if (!automationPaths) {
        return;
      }

      await ipcBridge.fs.writeFile.invoke({
        path: automationPaths.commandsFile,
        data: `${JSON.stringify(nextLibrary, null, 2)}\n`,
      });
    },
    [automationPaths]
  );

  const validateScheduleInput = useCallback((): ProjectScheduleEditorState | null => {
    const name = scheduleState.name.trim();
    const message = scheduleState.message.trim();
    const scheduleDescription = scheduleState.scheduleDescription.trim();
    const cronExpr = scheduleState.cronExpr.trim();

    if (!name) {
      messageApi.error(t('conversation.workspace.automation.scheduleEditor.validation.nameRequired'));
      return null;
    }

    if (!message) {
      messageApi.error(t('conversation.workspace.automation.scheduleEditor.validation.messageRequired'));
      return null;
    }

    if (!existingJob || existingJob.schedule.kind === 'cron') {
      if (!cronExpr) {
        messageApi.error(t('conversation.workspace.automation.scheduleEditor.validation.cronRequired'));
        return null;
      }

      if (!scheduleDescription) {
        messageApi.error(t('conversation.workspace.automation.scheduleEditor.validation.descriptionRequired'));
        return null;
      }
    }

    return {
      name,
      enabled: scheduleState.enabled,
      message,
      cronExpr,
      scheduleDescription,
    };
  }, [existingJob, messageApi, scheduleState, t]);

  const handleSaveSchedule = useCallback(async () => {
    const normalized = validateScheduleInput();
    if (!normalized || !directCreateContext) {
      return;
    }

    setScheduleSaving(true);
    try {
      if (existingJob) {
        const nextSchedule: IScheduleSpec | undefined =
          existingJob.schedule.kind === 'cron'
            ? {
                kind: 'cron',
                expr: normalized.cronExpr,
                description: normalized.scheduleDescription,
                tz: existingJob.schedule.tz,
              }
            : undefined;

        await updateJob(existingJob.id, {
          name: normalized.name,
          enabled: normalized.enabled,
          schedule: nextSchedule,
          target:
            existingJob.target.kind === 'send_query'
              ? {
                  ...existingJob.target,
                  message: normalized.message,
                }
              : existingJob.target,
        });

        messageApi.success(t('common.saveSuccess'));
        return;
      }

      await ipcBridge.schedule.createConversationSchedule.invoke({
        name: normalized.name,
        schedule: {
          kind: 'cron',
          expr: normalized.cronExpr,
          description: normalized.scheduleDescription,
        },
        message: normalized.message,
        conversationId: directCreateContext.conversationId,
        conversationTitle: directCreateContext.conversationTitle,
        workspacePath: directCreateContext.workspacePath,
        agentType: directCreateContext.agentType,
        createdBy: 'user',
      });

      messageApi.success(t('common.createSuccess'));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setScheduleSaving(false);
    }
  }, [directCreateContext, existingJob, messageApi, t, updateJob, validateScheduleInput]);

  const handleDeleteSchedule = useCallback(async () => {
    if (!existingJob) {
      return;
    }

    setScheduleDeleting(true);
    try {
      await deleteJob(existingJob.id);
      messageApi.success(t('schedule.deleteSuccess'));
      setScheduleState(EMPTY_SCHEDULE_EDITOR_STATE);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setScheduleDeleting(false);
    }
  }, [deleteJob, existingJob, messageApi, t]);

  const handleRunScheduleNow = useCallback(async () => {
    if (!existingJob) {
      return;
    }

    setScheduleRunningNow(true);
    try {
      await runJobNow(existingJob.id);
      messageApi.success(t('schedule.runNowSuccess'));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : t('common.unknownError'));
    } finally {
      setScheduleRunningNow(false);
    }
  }, [existingJob, messageApi, runJobNow, t]);

  const scheduleStatus = existingJob ? getJobStatusFlags(existingJob) : null;

  return (
    <SettingsSubModal
      visible={visible}
      title={t('conversation.workspace.automation.modalTitle')}
      onCancel={onClose}
      footer={null}
      unmountOnExit
      style={{ width: 'min(1100px, calc(100vw - 32px))' }}
      contentStyle={{ padding: '12px 24px 24px', maxHeight: 'min(82vh, 920px)', overflow: 'auto' }}
    >
      {messageContext}
      <div className='flex flex-col gap-16px'>
        <div className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-fill-1)] p-16px'>
          <Typography.Paragraph className='mb-0 text-t-secondary'>
            {t('conversation.workspace.automation.modalDescription')}
          </Typography.Paragraph>
          {automationPaths ? (
            <div className='mt-12px flex flex-wrap gap-8px'>
              <Button
                type='secondary'
                loading={revealingTarget === automationPaths.rootDir}
                icon={<FolderOpen theme='outline' size={14} />}
                onClick={() => void revealTarget(automationPaths.rootDir)}
              >
                {t('conversation.workspace.automation.openFolder')}
              </Button>
              <Button
                type='secondary'
                loading={revealingTarget === automationPaths.commandsFile}
                onClick={() => void revealTarget(automationPaths.commandsFile)}
              >
                {t('conversation.workspace.automation.openCommandsFile')}
              </Button>
              <Button
                type='secondary'
                loading={revealingTarget === automationPaths.schedulesFile}
                onClick={() => void revealTarget(automationPaths.schedulesFile)}
              >
                {t('conversation.workspace.automation.openSchedulesFile')}
              </Button>
            </div>
          ) : null}
        </div>

        {automationPaths ? (
          <ManagedCommandLibraryEditor
            variant='embedded'
            title={t('conversation.workspace.automation.commandsTitle')}
            description={t('conversation.workspace.automation.commandsDescription')}
            usageHint={t('conversation.workspace.automation.commandsUsageHint')}
            loadLibrary={loadProjectCommandLibrary}
            saveLibrary={saveProjectCommandLibrary}
            onLibraryChanged={() => {
              emitter.emit('commands.library.updated');
            }}
            headerMeta={
              <Typography.Text type='secondary'>
                {t('conversation.workspace.automation.commandsPathHint', { path: automationPaths.commandsFile })}
              </Typography.Text>
            }
          />
        ) : null}

        <div className='rounded-16px border border-solid border-[var(--color-border-2)] bg-[var(--color-bg-1)] p-16px'>
          <div className='flex flex-wrap items-start justify-between gap-16px'>
            <div className='max-w-720px'>
              <Typography.Title heading={5} className='!mb-0'>
                {t('conversation.workspace.automation.schedulesTitle')}
              </Typography.Title>
              <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                {t('conversation.workspace.automation.schedulesDescription')}
              </Typography.Paragraph>
              {automationPaths ? (
                <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                  {t('conversation.workspace.automation.schedulesPathHint', { path: automationPaths.schedulesFile })}
                </Typography.Paragraph>
              ) : null}
            </div>
            {existingJob ? (
              <div className='flex flex-wrap items-center gap-8px'>
                <Tag color={scheduleStatus?.hasError ? 'red' : scheduleStatus?.isPaused ? 'orange' : 'green'}>
                  {scheduleStatus?.hasError
                    ? t('schedule.status.error')
                    : scheduleStatus?.isPaused
                      ? t('schedule.status.paused')
                      : t('schedule.status.active')}
                </Tag>
                <Button
                  type='secondary'
                  icon={<Play theme='outline' size={14} />}
                  loading={scheduleRunningNow}
                  onClick={() => void handleRunScheduleNow()}
                >
                  {t('schedule.actions.runNow')}
                </Button>
                <Button
                  status='danger'
                  icon={<Delete theme='outline' size={14} />}
                  loading={scheduleDeleting}
                  onClick={() => void handleDeleteSchedule()}
                >
                  {t('schedule.actions.delete')}
                </Button>
              </div>
            ) : null}
          </div>

          {loading ? (
            <Typography.Text type='secondary'>{t('common.loading')}</Typography.Text>
          ) : (
            <div className='mt-16px flex flex-col gap-16px'>
              {!existingJob ? (
                <div className='rounded-12px bg-[var(--color-fill-1)] p-12px text-t-secondary'>
                  {t('conversation.workspace.automation.scheduleEmpty')}
                </div>
              ) : null}

              <div className='grid gap-12px md:grid-cols-2'>
                <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                  <Typography.Text bold>{t('schedule.drawer.name')}</Typography.Text>
                  <Input
                    className='mt-8px'
                    value={scheduleState.name}
                    placeholder={t('conversation.workspace.automation.scheduleEditor.namePlaceholder')}
                    onChange={(value) => setScheduleState((prev) => ({ ...prev, name: value }))}
                  />
                </div>

                <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                  <div className='flex items-center justify-between gap-12px'>
                    <Typography.Text bold>{t('schedule.drawer.taskStatus')}</Typography.Text>
                    <div className='flex items-center gap-8px'>
                      <Typography.Text type='secondary'>
                        {scheduleState.enabled ? t('schedule.drawer.enabled') : t('schedule.drawer.disabled')}
                      </Typography.Text>
                      <Switch
                        checked={scheduleState.enabled}
                        onChange={(enabled) => setScheduleState((prev) => ({ ...prev, enabled }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                <Typography.Text bold>{t('schedule.drawer.command')}</Typography.Text>
                <Input.TextArea
                  className='mt-8px'
                  value={scheduleState.message}
                  placeholder={t('schedule.drawer.commandPlaceholder')}
                  autoSize={{ minRows: 3, maxRows: 10 }}
                  onChange={(value) => setScheduleState((prev) => ({ ...prev, message: value }))}
                />
              </div>

              {existingJob && existingJob.schedule.kind !== 'cron' ? (
                <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                  <Typography.Text bold>{t('schedule.schedule')}</Typography.Text>
                  <Typography.Paragraph className='mb-0 mt-8px text-t-secondary'>
                    {t('conversation.workspace.automation.scheduleReadonlyHint', {
                      kind: existingJob.schedule.kind,
                    })}
                  </Typography.Paragraph>
                  <Typography.Paragraph className='mb-0 mt-8px'>
                    {existingJob.schedule.description}
                  </Typography.Paragraph>
                </div>
              ) : (
                <div className='grid gap-12px md:grid-cols-2'>
                  <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                    <Typography.Text bold>
                      {t('conversation.workspace.automation.scheduleEditor.cronExpressionLabel')}
                    </Typography.Text>
                    <Input
                      className='mt-8px'
                      value={scheduleState.cronExpr}
                      placeholder={t('conversation.workspace.automation.scheduleEditor.cronExpressionPlaceholder')}
                      onChange={(value) => setScheduleState((prev) => ({ ...prev, cronExpr: value }))}
                    />
                  </div>

                  <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                    <Typography.Text bold>
                      {t('conversation.workspace.automation.scheduleEditor.descriptionLabel')}
                    </Typography.Text>
                    <Input
                      className='mt-8px'
                      value={scheduleState.scheduleDescription}
                      placeholder={t('conversation.workspace.automation.scheduleEditor.descriptionPlaceholder')}
                      onChange={(value) => setScheduleState((prev) => ({ ...prev, scheduleDescription: value }))}
                    />
                  </div>
                </div>
              )}

              {existingJob ? (
                <div className='grid gap-12px md:grid-cols-2'>
                  <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                    <Typography.Text bold>{t('schedule.nextRun')}</Typography.Text>
                    <Typography.Paragraph className='mb-0 mt-8px'>
                      {formatNextRun(existingJob.state.nextRunAtMs)}
                    </Typography.Paragraph>
                  </div>
                  <div className='rounded-12px bg-[var(--color-fill-1)] p-12px'>
                    <Typography.Text bold>{t('schedule.lastRun')}</Typography.Text>
                    <Typography.Paragraph className='mb-0 mt-8px'>
                      {formatNextRun(existingJob.state.lastRunAtMs)}
                    </Typography.Paragraph>
                  </div>
                </div>
              ) : null}

              <div className='flex justify-end'>
                <Button
                  type='primary'
                  loading={scheduleSaving}
                  disabled={!directCreateContext}
                  onClick={() => void handleSaveSchedule()}
                >
                  {existingJob ? t('common.save') : t('common.create')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SettingsSubModal>
  );
};

export default ProjectAutomationModal;
