import type { WorkbenchDefinition } from './types';

export const conversationCoworkWorkbench: WorkbenchDefinition = {
  kind: 'conversation-cowork',
  capabilities: ['chat', 'preview', 'workspace', 'browser'],
  shellContract: {
    shellStyle: 'conversation',
    titlebar: {
      primarySlotId: 'app-titlebar-chat-slot',
    },
    toolbar: {
      slotId: 'app-titlebar-toolbar-slot',
    },
  },
};

export const getWorkbenchDefinitionForPath = (pathname: string): WorkbenchDefinition | null => {
  if (pathname.startsWith('/conversation/')) {
    return conversationCoworkWorkbench;
  }

  return null;
};
