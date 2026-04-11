export const shouldApplyInitialConversationBottomPosition = (
  conversationId?: string,
  targetMessageId?: string
): boolean => Boolean(conversationId) && !targetMessageId;

export const getInitialConversationBottomItemIndex = (
  conversationId: string | undefined,
  itemCount: number,
  targetMessageId?: string
): number | null => {
  if (!shouldApplyInitialConversationBottomPosition(conversationId, targetMessageId)) {
    return null;
  }

  if (itemCount <= 0) {
    return null;
  }

  return itemCount - 1;
};
