import React from 'react';
import { WorkbenchHostContext, type WorkbenchKind } from './context';

type WorkbenchHostProps = {
  workbenchKind: WorkbenchKind;
  children: React.ReactNode;
};

const WorkbenchHost: React.FC<WorkbenchHostProps> = ({ workbenchKind, children }) => {
  return (
    <WorkbenchHostContext.Provider value={{ workbenchKind }}>
      <div className='workbench-host size-full min-h-0' data-workbench-kind={workbenchKind}>
        {children}
      </div>
    </WorkbenchHostContext.Provider>
  );
};

export default WorkbenchHost;
