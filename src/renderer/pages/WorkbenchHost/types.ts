export type WorkbenchKind = 'conversation-cowork';

export type WorkbenchCapability = 'chat' | 'preview' | 'workspace' | 'browser';

export type WorkbenchShellTitlebarContract = {
  primarySlotId: string;
};

export type WorkbenchShellToolbarContract = {
  slotId: string;
};

export type WorkbenchShellContract = {
  shellStyle: 'conversation';
  titlebar?: WorkbenchShellTitlebarContract;
  toolbar?: WorkbenchShellToolbarContract;
};

export type WorkbenchDefinition = {
  kind: WorkbenchKind;
  capabilities: WorkbenchCapability[];
  shellContract: WorkbenchShellContract;
};
