/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import AgentWorkspace from './Workspace';
import SettingsPageWrapper from '../components/SettingsPageWrapper';

const AgentSettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <AgentWorkspace />
    </SettingsPageWrapper>
  );
};

export default AgentSettings;
