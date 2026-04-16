import type { WorkbenchDefinition } from './types';

export const conversationCoworkWorkbench: WorkbenchDefinition = {
  kind: 'conversation-cowork',
  capabilities: ['chat', 'preview', 'workspace', 'browser'],
  shellContract: {
    shellStyle: 'conversation',
    titlebarSlot: 'conversation-primary',
    toolbarSlot: 'conversation-toolbar',
  },
};
