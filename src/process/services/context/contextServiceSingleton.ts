/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { uuid } from '@/common/utils';
import { createSqliteContextEngineDependencies } from '../database/context/SqliteContextStores';
import { ContextRuntimeService } from './ContextRuntimeService';
import { ContextServiceImpl } from './ContextServiceImpl';
import { createVectorIndexProviderFromEnv } from './vector/VectorProviderFactory';

const vectorIndex = createVectorIndexProviderFromEnv();

export const contextService = new ContextServiceImpl(
  createSqliteContextEngineDependencies({
    vectorIndex,
  })
);

export const contextRuntimeService = new ContextRuntimeService(contextService, ({ conversationId, candidates }) => {
  const preview = candidates
    .slice(0, 3)
    .map((candidate) => `- ${candidate.summary}`)
    .join('\n');

  ipcBridge.conversation.responseStream.emit({
    type: 'system',
    conversation_id: conversationId,
    msg_id: uuid(),
    data: `[ContextGo Review Required]\n${candidates.length} memory candidate(s) need human review before promotion.\n${preview}`,
  });
});
