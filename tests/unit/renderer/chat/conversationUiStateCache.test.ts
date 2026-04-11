import { beforeEach, describe, expect, it } from 'vitest';

import {
  getConversationUiStateScopeSize,
  readConversationUiState,
  writeConversationUiState,
} from '@/renderer/pages/conversation/hooks/conversationUiStateCache';

const TEST_SCOPE = 'cache-eviction-test';

describe('conversationUiStateCache', () => {
  beforeEach(() => {
    for (let index = 0; index < 50; index += 1) {
      writeConversationUiState(TEST_SCOPE, `reset-${index}`, { value: index });
    }
  });

  it('evicts the oldest entries when a scope exceeds the cache limit', () => {
    expect(getConversationUiStateScopeSize(TEST_SCOPE)).toBeLessThanOrEqual(40);
    expect(readConversationUiState(TEST_SCOPE, 'reset-0', null)).toBeNull();
    expect(readConversationUiState(TEST_SCOPE, 'reset-49', null)).toEqual({ value: 49 });
  });

  it('refreshes recency when rewriting an existing conversation state', () => {
    writeConversationUiState(TEST_SCOPE, 'sticky-conversation', { value: 'first' });

    for (let index = 0; index < 45; index += 1) {
      writeConversationUiState(TEST_SCOPE, `rolling-${index}`, { value: index });
    }

    expect(readConversationUiState(TEST_SCOPE, 'sticky-conversation', null)).toBeNull();

    writeConversationUiState(TEST_SCOPE, 'sticky-conversation', { value: 'updated' });

    for (let index = 45; index < 79; index += 1) {
      writeConversationUiState(TEST_SCOPE, `rolling-${index}`, { value: index });
    }

    expect(readConversationUiState(TEST_SCOPE, 'sticky-conversation', null)).toEqual({ value: 'updated' });
  });
});
