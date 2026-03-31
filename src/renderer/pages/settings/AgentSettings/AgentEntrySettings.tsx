/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import ChannelModalContent from '@/renderer/components/settings/SettingsModal/contents/channels/ChannelModalContent';
import React from 'react';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const AgentEntrySettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <ChannelModalContent />
    </SettingsPageWrapper>
  );
};

export default AgentEntrySettings;
