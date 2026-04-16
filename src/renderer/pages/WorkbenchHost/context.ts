import React from 'react';

export type WorkbenchKind = 'conversation-cowork';

export type WorkbenchHostContextValue = {
  workbenchKind: WorkbenchKind;
};

export const WorkbenchHostContext = React.createContext<WorkbenchHostContextValue | null>(null);

export const useWorkbenchHostContext = (): WorkbenchHostContextValue | null => {
  return React.useContext(WorkbenchHostContext);
};
