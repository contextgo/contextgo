/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import React from 'react';
import { renderWorkflowHeaderAddon } from './group/workflow/workflowUiRegistry';

type HeaderAddonRenderContext = {
  conversation: TChatConversation;
};

type HeaderAddonDefinition = {
  id: string;
  shouldRender: (context: HeaderAddonRenderContext) => boolean;
  render: (context: HeaderAddonRenderContext) => React.ReactNode;
};

const headerAddonDefinitions: HeaderAddonDefinition[] = [
  {
    id: 'group-workflow',
    shouldRender: ({ conversation }) =>
      conversation.type === 'group' && conversation.extra.orchestration.kind === 'workflow',
    render: ({ conversation }) => renderWorkflowHeaderAddon(conversation),
  },
];

export const renderConversationHeaderAddons = (context: HeaderAddonRenderContext): React.ReactNode[] => {
  return headerAddonDefinitions
    .filter((definition) => definition.shouldRender(context))
    .map((definition) => (
      <div key={definition.id} className='shrink-0'>
        {definition.render(context)}
      </div>
    ))
    .filter(Boolean);
};
