/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IContextSchedule } from '@/common/adapter/ipcBridge';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { Drawer, Form, Input, Switch, Message, Button, Popconfirm } from '@arco-design/web-react';
import { AlarmClock, DeleteOne, Play } from '@icon-park/react';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import styles from './ScheduleJobDrawer.module.css';

const FormItem = Form.Item;
const TextArea = Input.TextArea;

interface ScheduleJobDrawerProps {
  visible: boolean;
  job: IContextSchedule;
  onClose: () => void;
  onSave: (updates: { message: string; enabled: boolean; schedule?: IContextSchedule['schedule'] }) => Promise<void>;
  onRunNow: () => Promise<void>;
  onDelete: () => Promise<void>;
}

const ScheduleJobDrawer: React.FC<ScheduleJobDrawerProps> = ({ visible, job, onClose, onSave, onRunNow, onDelete }) => {
  const { t } = useTranslation();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Parse initial values from job
  const initialValues = useMemo(() => {
    return {
      enabled: job.enabled,
      command: job.target.kind === 'send_query' ? job.target.message : job.target.reason,
      cronExpr: job.schedule.kind === 'cron' ? job.schedule.expr : '',
      scheduleDescription: job.schedule.description,
    };
  }, [job]);

  // Format next run time
  const nextRunTime = useMemo(() => {
    if (!job.state.nextRunAtMs) return null;
    return dayjs(job.state.nextRunAtMs).format('YYYY-MM-DD HH:mm');
  }, [job.state.nextRunAtMs]);

  // Reset form when job changes
  useEffect(() => {
    if (visible) {
      form.setFieldsValue(initialValues);
    }
  }, [visible, initialValues, form]);

  const isCronSchedule = job.schedule.kind === 'cron';

  const handleSave = async () => {
    try {
      const values = await form.validate();
      setSaving(true);

      await onSave({
        message: values.command,
        enabled: values.enabled,
        schedule: isCronSchedule
          ? {
              kind: 'cron',
              expr: values.cronExpr,
              description: values.scheduleDescription,
              tz: job.schedule.kind === 'cron' ? job.schedule.tz : undefined,
            }
          : undefined,
      });

      Message.success(t('schedule.drawer.saveSuccess'));
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        Message.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setRunningNow(true);
    try {
      await onRunNow();
      Message.success(t('schedule.runNowSuccess'));
    } catch (err) {
      Message.error(err instanceof Error ? err.message : String(err));
    } finally {
      setRunningNow(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      Message.success(t('schedule.deleteSuccess'));
      onClose();
    } catch (err) {
      Message.error(String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer
      className={styles.cronDrawer}
      placement={isMobile ? 'bottom' : 'right'}
      width={isMobile ? 'calc(100vw - 12px)' : 400}
      height={isMobile ? 'min(84vh, 760px)' : undefined}
      title={
        <div className='inline-flex items-center gap-8px'>
          <AlarmClock theme='outline' size={18} strokeWidth={4} fill='currentColor' className='flex items-center' />
          <span className='leading-none'>{t('schedule.drawer.title')}</span>
        </div>
      }
      visible={visible}
      onCancel={onClose}
      bodyStyle={{
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: isMobile ? '14px 14px 18px' : undefined,
      }}
      footer={
        <div className='flex items-center justify-between gap-8px'>
          <Popconfirm title={t('schedule.confirmDelete')} onOk={handleDelete}>
            <Button status='danger' shape='round' loading={deleting} icon={<DeleteOne theme='outline' size={14} />}>
              {t('schedule.actions.delete')}
            </Button>
          </Popconfirm>
          <div className='flex items-center gap-8px'>
            <Button
              type='outline'
              shape='round'
              loading={runningNow}
              icon={<Play theme='outline' size={14} />}
              onClick={handleRunNow}
            >
              {t('schedule.actions.runNow')}
            </Button>
            <Button type='primary' shape='round' loading={saving} onClick={handleSave}>
              {t('schedule.drawer.save')}
            </Button>
          </div>
        </div>
      }
    >
      <Form form={form} layout='vertical' initialValues={initialValues} className='space-y-12px'>
        <div className='bg-2 rd-16px px-16px py-16px'>
          <div className='flex items-center justify-between'>
            <span className='text-14px'>{t('schedule.drawer.name')}</span>
            <span className='text-14px font-medium max-w-[60%] text-right break-words'>{job.name}</span>
          </div>
        </div>

        <div className='bg-2 rd-16px px-16px py-16px'>
          <div className='flex items-center justify-between'>
            <span className='text-14px'>{t('schedule.drawer.taskStatus')}</span>
            <div className='flex items-center gap-8px'>
              <Form.Item shouldUpdate noStyle>
                {(values) => (
                  <span className='text-14px text-text-3'>
                    {values.enabled ? t('schedule.drawer.enabled') : t('schedule.drawer.disabled')}
                  </span>
                )}
              </Form.Item>
              <FormItem field='enabled' triggerPropName='checked' noStyle>
                <Switch />
              </FormItem>
            </div>
          </div>
        </div>

        <div className='bg-2 rd-16px px-16px py-16px'>
          <FormItem label={t('schedule.drawer.command')} field='command' rules={[{ required: true }]} className='!mb-0'>
            <TextArea
              placeholder={t('schedule.drawer.commandPlaceholder')}
              autoSize={{ minRows: 2, maxRows: 10 }}
              className='!bg-bg-1'
            />
          </FormItem>
        </div>

        <div className='bg-2 rd-16px px-16px py-16px space-y-12px'>
          {isCronSchedule ? (
            <>
              <FormItem
                label={t('schedule.drawer.cronExpression')}
                field='cronExpr'
                rules={[{ required: true }]}
                className='!mb-0'
              >
                <Input placeholder={t('schedule.drawer.cronExpressionPlaceholder')} className='!bg-bg-1' />
              </FormItem>
              <FormItem
                label={t('schedule.drawer.scheduleDescription')}
                field='scheduleDescription'
                rules={[{ required: true }]}
                className='!mb-0'
              >
                <Input placeholder={t('schedule.drawer.scheduleDescriptionPlaceholder')} className='!bg-bg-1' />
              </FormItem>
            </>
          ) : (
            <div className='flex items-center justify-between gap-12px'>
              <span className='text-14px'>{t('schedule.drawer.schedule')}</span>
              <span className='text-13px text-text-3 text-right'>{t('schedule.drawer.readOnlyScheduleHint')}</span>
            </div>
          )}

          <div className='flex items-center justify-between'>
            <span className='text-14px'>{t('schedule.drawer.schedule')}</span>
            <span className='text-14px font-medium max-w-[62%] text-right break-words'>{job.schedule.description}</span>
          </div>
          {nextRunTime && (
            <div className='flex items-center justify-between'>
              <span className='text-14px'>{t('schedule.drawer.nextRun')}</span>
              <span className='text-14px font-medium max-w-[62%] text-right break-words'>{nextRunTime}</span>
            </div>
          )}
        </div>
      </Form>
    </Drawer>
  );
};

export default ScheduleJobDrawer;
