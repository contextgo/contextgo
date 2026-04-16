export type WorkbenchKind = 'conversation-cowork';

export type WorkbenchCapability = 'chat' | 'preview' | 'workspace' | 'browser';

export type WorkbenchShellContract = {
  shellStyle: 'conversation';
  titlebarSlot: 'conversation-primary';
  toolbarSlot: 'conversation-toolbar';
};

export type WorkbenchDefinition = {
  kind: WorkbenchKind;
  capabilities: WorkbenchCapability[];
  shellContract: WorkbenchShellContract;
};
