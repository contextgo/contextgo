/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { normalizeManagedSlashCommandLibrary } from '@/common/chat/slash/library';
import { ConfigStorage } from '@/common/config/storage';
import SettingsPageWrapper from '@/renderer/pages/settings/components/SettingsPageWrapper';
import { emitter } from '@/renderer/utils/emitter';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import ManagedCommandLibraryEditor from './ManagedCommandLibraryEditor';

const CommandSettings: React.FC = () => {
  const { t } = useTranslation();

  const loadLibrary = useCallback(async () => {
    const storedLibrary = await ConfigStorage.get('command.library');
    const normalizedLibrary = normalizeManagedSlashCommandLibrary(storedLibrary);
    if (JSON.stringify(storedLibrary) !== JSON.stringify(normalizedLibrary)) {
      await ConfigStorage.set('command.library', normalizedLibrary);
    }
    return normalizedLibrary;
  }, []);

  const saveLibrary = useCallback(async (nextLibrary: ReturnType<typeof normalizeManagedSlashCommandLibrary>) => {
    await ConfigStorage.set('command.library', nextLibrary);
  }, []);

  return (
    <SettingsPageWrapper contentClassName='pb-[calc(24px+env(safe-area-inset-bottom,0px))]'>
      <ManagedCommandLibraryEditor
        title={t('settings.commands.title')}
        description={t('settings.commands.description')}
        usageHint={t('settings.commands.usageHint')}
        loadLibrary={loadLibrary}
        saveLibrary={saveLibrary}
        onLibraryChanged={() => {
          emitter.emit('commands.library.updated');
        }}
      />
    </SettingsPageWrapper>
  );
};

export default CommandSettings;
