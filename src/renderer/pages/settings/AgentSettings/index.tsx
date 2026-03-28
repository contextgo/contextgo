/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import AgentModalContent from '@/renderer/components/settings/SettingsModal/contents/AgentModalContent';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const AgentSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <AgentModalContent />
    </SettingsPageWrapper>
  );
};

export default AgentSettings;
