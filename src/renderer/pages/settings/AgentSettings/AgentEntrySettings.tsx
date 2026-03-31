/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import ChannelModalContent from '@/renderer/components/settings/SettingsModal/contents/channels/ChannelModalContent';
import React from 'react';
import { useLocation } from 'react-router-dom';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const AgentEntrySettings: React.FC = () => {
  const { pathname } = useLocation();
  const mode = pathname.endsWith('/active-sessions') ? 'sessions' : 'channels';

  return (
    <SettingsPageWrapper>
      <ChannelModalContent mode={mode} />
    </SettingsPageWrapper>
  );
};

export default AgentEntrySettings;
