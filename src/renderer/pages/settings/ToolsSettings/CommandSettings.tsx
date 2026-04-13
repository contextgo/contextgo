/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';
import { Empty, Typography } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

const CommandSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <SettingsPageWrapper contentClassName='pb-[calc(24px+env(safe-area-inset-bottom,0px))]'>
      <div className='flex flex-col gap-16px'>
        <Typography.Title heading={5}>{t('settings.commands.title')}</Typography.Title>
        <Typography.Paragraph>{t('settings.commands.description')}</Typography.Paragraph>
        <Typography.Paragraph type='secondary'>{t('settings.commands.usageHint')}</Typography.Paragraph>
        <Empty description={t('settings.commands.emptyState')} />
      </div>
    </SettingsPageWrapper>
  );
};

export default CommandSettings;
