/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getWorkflowGroupTemplateDefinition } from '@/common/config/group';
import type { TChatConversation, WorkflowGroupDecision, WorkflowGroupRunState } from '@/common/config/storage';
import { Button, Popover, Tag, Typography } from '@arco-design/web-react';
import { CompassOne } from '@icon-park/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

type WorkflowConversation = Extract<TChatConversation, { type: 'group' }>;

const STATUS_COLOR_BY_STATE: Record<WorkflowGroupRunState['status'], string> = {
  idle: 'gray',
  running: 'arcoblue',
  completed: 'green',
  failed: 'red',
  stopped: 'orangered',
};

const DECISION_COLOR_BY_VALUE: Record<WorkflowGroupDecision, string> = {
  continue: 'arcoblue',
  accept: 'green',
  stop: 'orangered',
};

const detailRowClassName = 'grid grid-cols-[92px_minmax(0,1fr)] items-start gap-x-8px gap-y-2px';

const WorkflowHeaderAddon: React.FC<{ conversation: WorkflowConversation }> = ({ conversation }) => {
  const { t } = useTranslation();
  const orchestration = conversation.extra.orchestration;
  if (orchestration.kind !== 'workflow') {
    return null;
  }

  const templateDefinition = getWorkflowGroupTemplateDefinition(orchestration.template);
  const runState = conversation.extra.runState;
  const status = runState?.status || 'idle';
  const stage = runState?.stage || 'planning';
  const decision = runState?.latestDecision;
  const artifactPath = runState?.artifactPath || orchestration.artifactPath || templateDefinition.defaults.artifactPath;

  const content = (
    <div className='flex min-w-260px max-w-320px flex-col gap-10px'>
      <div className='flex items-center justify-between gap-8px'>
        <Typography.Text className='font-medium'>{t(templateDefinition.labelKey)}</Typography.Text>
        <Tag color={STATUS_COLOR_BY_STATE[status]}>{t(`conversation.group.workflow.status.${status}`)}</Tag>
      </div>

      <Typography.Paragraph className='!mb-0 text-[var(--color-text-2)]' ellipsis={{ rows: 3, expandable: false }}>
        {t(templateDefinition.hintKey)}
      </Typography.Paragraph>

      <div className='flex flex-col gap-6px text-12px'>
        <div className={detailRowClassName}>
          <Typography.Text type='secondary'>{t('conversation.group.workflow.stageLabel')}</Typography.Text>
          <Typography.Text>{t(`conversation.group.workflow.stage.${stage}`)}</Typography.Text>
        </div>
        <div className={detailRowClassName}>
          <Typography.Text type='secondary'>{t('conversation.group.workflow.iterationBudgetLabel')}</Typography.Text>
          <Typography.Text>
            {t('conversation.group.workflow.iterationBudgetValue', {
              current: runState?.iteration ?? 0,
              total: orchestration.maxIterations,
            })}
          </Typography.Text>
        </div>
        <div className={detailRowClassName}>
          <Typography.Text type='secondary'>{t('conversation.group.workflow.scoreTargetLabel')}</Typography.Text>
          <Typography.Text>{orchestration.scoreTarget}</Typography.Text>
        </div>
        <div className={detailRowClassName}>
          <Typography.Text type='secondary'>{t('conversation.group.workflow.reviewModeLabel')}</Typography.Text>
          <Typography.Text>
            {t(
              `conversation.group.workflow.reviewMode.${orchestration.reviewMode === 'final-only' ? 'finalOnly' : 'perIteration'}`
            )}
          </Typography.Text>
        </div>
        <div className={detailRowClassName}>
          <Typography.Text type='secondary'>{t('conversation.group.workflow.artifactPathLabel')}</Typography.Text>
          <Typography.Text copyable={{ text: artifactPath }}>{artifactPath}</Typography.Text>
        </div>
        {runState?.latestScore !== undefined ? (
          <div className={detailRowClassName}>
            <Typography.Text type='secondary'>{t('conversation.group.workflow.latestScoreLabel')}</Typography.Text>
            <Typography.Text>{runState.latestScore}</Typography.Text>
          </div>
        ) : null}
        {decision ? (
          <div className={detailRowClassName}>
            <Typography.Text type='secondary'>{t('conversation.group.workflow.latestDecisionLabel')}</Typography.Text>
            <Tag color={DECISION_COLOR_BY_VALUE[decision]}>{t(`conversation.group.workflow.decision.${decision}`)}</Tag>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <Popover content={content} position='bl'>
      <Button size='mini' type='secondary'>
        <span className='flex items-center gap-6px'>
          <CompassOne size={14} />
          <span className='truncate'>{t(templateDefinition.labelKey)}</span>
          <Tag color={STATUS_COLOR_BY_STATE[status]}>{t(`conversation.group.workflow.stage.${stage}`)}</Tag>
        </span>
      </Button>
    </Popover>
  );
};

export default WorkflowHeaderAddon;
