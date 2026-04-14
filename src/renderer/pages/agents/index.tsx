import React from 'react';
import AgentWorkspace from '@/renderer/pages/settings/AgentSettings/Workspace';

const AgentsPage: React.FC = () => {
  return (
    <div className='secondary-page-frame'>
      <div className='secondary-page-inner'>
        <AgentWorkspace />
      </div>
    </div>
  );
};

export default AgentsPage;
