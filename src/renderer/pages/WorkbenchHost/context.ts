import React from 'react';
import type { WorkbenchDefinition, WorkbenchKind } from './types';

export type WorkbenchHostContextValue = {
  definition: WorkbenchDefinition;
  workbenchKind: WorkbenchKind;
};

export const WorkbenchHostContext = React.createContext<WorkbenchHostContextValue | null>(null);

export const useWorkbenchHostContext = (): WorkbenchHostContextValue | null => {
  return React.useContext(WorkbenchHostContext);
};
