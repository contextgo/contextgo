import type { WorkbenchDefinition } from './types';

export const getWorkbenchTitlebarPrimarySlotId = (
  definition: WorkbenchDefinition | null | undefined
): string | null => {
  return definition?.shellContract.titlebar?.primarySlotId ?? null;
};

export const getWorkbenchToolbarSlotId = (definition: WorkbenchDefinition | null | undefined): string | null => {
  return definition?.shellContract.toolbar?.slotId ?? null;
};
