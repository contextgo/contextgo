const conversationUiStateScopes = new Map<string, Map<string, unknown>>();
const MAX_CACHED_CONVERSATIONS_PER_SCOPE = 40;

const getConversationUiStateScope = (scope: string): Map<string, unknown> => {
  const existingScope = conversationUiStateScopes.get(scope);
  if (existingScope) {
    return existingScope;
  }

  const nextScope = new Map<string, unknown>();
  conversationUiStateScopes.set(scope, nextScope);
  return nextScope;
};

export const hasConversationUiState = (scope: string, conversationId: string): boolean => {
  if (!conversationId) {
    return false;
  }

  return getConversationUiStateScope(scope).has(conversationId);
};

export const readConversationUiState = <T>(scope: string, conversationId: string, fallback: T): T => {
  if (!conversationId) {
    return fallback;
  }

  return (getConversationUiStateScope(scope).get(conversationId) as T | undefined) ?? fallback;
};

export const writeConversationUiState = <T>(scope: string, conversationId: string, state: T): void => {
  if (!conversationId) {
    return;
  }

  const scopedCache = getConversationUiStateScope(scope);

  if (scopedCache.has(conversationId)) {
    scopedCache.delete(conversationId);
  }

  scopedCache.set(conversationId, state);

  while (scopedCache.size > MAX_CACHED_CONVERSATIONS_PER_SCOPE) {
    const oldestConversationId = scopedCache.keys().next().value;
    if (!oldestConversationId) {
      break;
    }
    scopedCache.delete(oldestConversationId);
  }
};

export const getConversationUiStateScopeSize = (scope: string): number => {
  return getConversationUiStateScope(scope).size;
};
