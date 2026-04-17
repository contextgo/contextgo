import type { TChatConversation } from '@/common/config/storage';
import type { PreviewTab } from '@/renderer/pages/conversation/Preview/context/PreviewContext';

export type ConversationCapabilityState = {
  browser: {
    visible: true;
    label?: string;
  };
  workspace: {
    available: boolean;
    label?: string;
  };
  preview: {
    open: boolean;
    label?: string;
  };
};

export const getConversationCapabilityState = (
  conversation: TChatConversation,
  activePreviewTab: PreviewTab | null
): ConversationCapabilityState => ({
  browser: {
    visible: true,
  },
  workspace: {
    available: Boolean(conversation.extra?.workspace),
    label: conversation.extra?.workspace || undefined,
  },
  preview: {
    open: Boolean(activePreviewTab),
    label: activePreviewTab?.metadata?.fileName || activePreviewTab?.title || undefined,
  },
});
