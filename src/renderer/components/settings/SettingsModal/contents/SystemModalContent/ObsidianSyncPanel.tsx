/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CloudObsidianVaultBinding } from '@/common/types/cloud';
import { Alert, Tag, Typography } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Paragraph, Text } = Typography;

type ObsidianSyncPanelProps = {
  binding: CloudObsidianVaultBinding;
};

const ObsidianSyncPanel: React.FC<ObsidianSyncPanelProps> = ({ binding }) => {
  const { t } = useTranslation();

  return (
    <div className='rounded-12px border border-solid border-border-2 p-16px bg-[var(--color-fill-1)] space-y-12px'>
      <div className='flex items-center justify-between gap-12px'>
        <div className='min-w-0'>
          <div className='text-14px font-500 text-t-primary'>
            {t('settings.cloud.obsidianSync.title', {
              defaultValue: 'Obsidian vault sync',
            })}
          </div>
          <Paragraph className='!mb-0 text-12px !text-[var(--color-text-secondary)]'>
            {t('settings.cloud.obsidianSync.description', {
              defaultValue: 'This Space is linked to an Obsidian vault binding managed through ContextGo Cloud.',
            })}
          </Paragraph>
        </div>
        <Tag color={binding.riskLevel === 'external-sync-risk' ? 'orange' : 'green'}>
          {binding.riskLevel ?? 'normal'}
        </Tag>
      </div>

      <Alert
        type='info'
        content={
          <div className='space-y-4px'>
            <div>{binding.vaultBindingId}</div>
            <Text>{binding.spaceId}</Text>
          </div>
        }
      />

      <div className='space-y-8px'>
        {binding.replicas.map((replica) => (
          <div key={replica.replicaId} className='flex items-center justify-between gap-8px rounded-8px bg-[var(--color-bg-2)] px-12px py-10px'>
            <div className='flex items-center gap-8px min-w-0'>
              <Text>{replica.replicaId}</Text>
              <Tag color='arcoblue'>{replica.platform}</Tag>
            </div>
            <Tag color={replica.healthStatus === 'ok' ? 'green' : replica.healthStatus === 'warn' ? 'orange' : 'red'}>
              {replica.healthStatus}
            </Tag>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ObsidianSyncPanel;
