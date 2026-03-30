/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Collapse, Message } from '@arco-design/web-react';
import React from 'react';
import AssistantManagement from '@/renderer/pages/settings/AgentSettings/AssistantManagement';
import ContextGoScrollArea from '@/renderer/components/base/ContextGoScrollArea';
import { useSettingsViewMode } from '../settingsViewContext';

const AgentModalContent: React.FC = () => {
  const [agentMessage, agentMessageContext] = Message.useMessage({ maxCount: 10 });
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  return (
    <div className='flex flex-col h-full w-full'>
      {agentMessageContext}

      <ContextGoScrollArea className='flex-1 min-h-0 pb-16px scrollbar-hide' disableOverflow={isPageMode}>
        {isPageMode ? (
          <AssistantManagement message={agentMessage} />
        ) : (
          <Collapse defaultActiveKey={['smart-assistants']}>
            <AssistantManagement message={agentMessage} />
          </Collapse>
        )}
      </ContextGoScrollArea>
    </div>
  );
};

export default AgentModalContent;
