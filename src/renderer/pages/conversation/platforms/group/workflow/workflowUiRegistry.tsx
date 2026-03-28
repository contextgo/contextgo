/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_WORKFLOW_GROUP_TEMPLATE } from '@/common/config/group';
import type { TChatConversation, WorkflowGroupTemplate } from '@/common/config/storage';
import React from 'react';
import WorkflowHeaderAddon from './WorkflowHeaderAddon';

type WorkflowConversation = Extract<TChatConversation, { type: 'group' }>;

const workflowHeaderAddonRegistry: Record<
  WorkflowGroupTemplate,
  React.ComponentType<{ conversation: WorkflowConversation }>
> = {
  [DEFAULT_WORKFLOW_GROUP_TEMPLATE]: WorkflowHeaderAddon,
};

export const renderWorkflowHeaderAddon = (conversation: TChatConversation): React.ReactNode => {
  if (conversation.type !== 'group' || conversation.extra.orchestration.kind !== 'workflow') {
    return null;
  }

  const Component = workflowHeaderAddonRegistry[conversation.extra.orchestration.template];
  if (!Component) {
    return null;
  }

  return <Component conversation={conversation} />;
};
