/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ToolsModalContent from '@/renderer/components/settings/SettingsModal/contents/ToolsModalContent';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const ToolsSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <ToolsModalContent />
    </SettingsPageWrapper>
  );
};

export default ToolsSettings;
