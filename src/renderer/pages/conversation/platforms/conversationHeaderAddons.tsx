/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import type { PreviewMetadata } from '@/renderer/pages/conversation/Preview/context/PreviewContext';
import React from 'react';
import StarOfficeMonitorCard from './openclaw/StarOfficeMonitorCard.tsx';
import { renderWorkflowHeaderAddon } from './group/workflow/workflowUiRegistry';

type HeaderAddonRenderContext = {
  conversation: TChatConversation;
  openUrlPreview: (url: string, metadata?: PreviewMetadata) => void;
};

type HeaderAddonDefinition = {
  id: string;
  shouldRender: (context: HeaderAddonRenderContext) => boolean;
  render: (context: HeaderAddonRenderContext) => React.ReactNode;
};

const headerAddonDefinitions: HeaderAddonDefinition[] = [
  {
    id: 'openclaw-monitor',
    shouldRender: ({ conversation }) => conversation.type === 'openclaw-gateway',
    render: ({ conversation, openUrlPreview }) => (
      <StarOfficeMonitorCard
        conversationId={conversation.id}
        onOpenUrl={(url, metadata) => {
          openUrlPreview(url, metadata);
        }}
      />
    ),
  },
  {
    id: 'group-workflow',
    shouldRender: ({ conversation }) => conversation.type === 'group' && conversation.extra.orchestration.kind === 'workflow',
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
