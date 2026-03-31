/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import ChannelModalContent from '@/renderer/components/settings/SettingsModal/contents/channels/ChannelModalContent';
import RuntimeManagement from '@/renderer/pages/settings/AgentSettings/CustomAcpAgent';
import React from 'react';
import { useLocation } from 'react-router-dom';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const AgentEntrySettings: React.FC = () => {
  const { pathname } = useLocation();
  const mode = pathname.endsWith('/runtime')
    ? 'runtime'
    : pathname.endsWith('/active-sessions')
      ? 'sessions'
      : 'channels';

  return (
    <SettingsPageWrapper contentClassName={mode === 'runtime' ? 'max-w-1200px' : undefined}>
      {mode === 'runtime' ? <RuntimeManagement /> : <ChannelModalContent mode={mode} />}
    </SettingsPageWrapper>
  );
};

export default AgentEntrySettings;
