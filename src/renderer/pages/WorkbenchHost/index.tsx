import React from 'react';
import { WorkbenchHostContext } from './context';
import type { WorkbenchDefinition } from './types';

type WorkbenchHostProps = {
  definition: WorkbenchDefinition;
  children: React.ReactNode;
};

const WorkbenchHost: React.FC<WorkbenchHostProps> = ({ definition, children }) => {
  return (
    <WorkbenchHostContext.Provider
      value={{
        definition,
        workbenchKind: definition.kind,
      }}
    >
      <div className='workbench-host size-full min-h-0' data-workbench-kind={definition.kind}>
        {children}
      </div>
    </WorkbenchHostContext.Provider>
  );
};

export default WorkbenchHost;
