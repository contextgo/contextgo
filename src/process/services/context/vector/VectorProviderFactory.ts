/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InMemoryVectorIndexProvider,
  type VectorIndexProvider,
} from '../../../../../packages/context-engine/src/vectorIndex';
import {
  OpenAICompatibleEmbeddingProvider,
  type OpenAICompatibleEmbeddingConfig,
} from './OpenAICompatibleEmbeddingProvider';
import { QdrantVectorProvider, type QdrantVectorProviderConfig } from './QdrantVectorProvider';

export type VectorProviderKind = 'disabled' | 'memory' | 'qdrant';

export type ContextVectorProviderConfig =
  | { kind: 'disabled' }
  | { kind: 'memory' }
  | {
      kind: 'qdrant';
      qdrant: QdrantVectorProviderConfig;
      embedding: OpenAICompatibleEmbeddingConfig;
    };

export function createVectorIndexProvider(config: ContextVectorProviderConfig): VectorIndexProvider | undefined {
  switch (config.kind) {
    case 'disabled':
      return undefined;
    case 'memory':
      return new InMemoryVectorIndexProvider();
    case 'qdrant':
      return new QdrantVectorProvider(config.qdrant, new OpenAICompatibleEmbeddingProvider(config.embedding));
    default:
      return undefined;
  }
}

export function createVectorIndexProviderFromEnv(env: NodeJS.ProcessEnv = process.env): VectorIndexProvider | undefined {
  const kind = (env.CONTEXTGO_VECTOR_PROVIDER || 'disabled') as VectorProviderKind;
  if (kind === 'memory') {
    return createVectorIndexProvider({ kind: 'memory' });
  }
  if (kind !== 'qdrant') {
    return undefined;
  }

  const qdrantUrl = env.CONTEXTGO_QDRANT_URL;
  const qdrantCollection = env.CONTEXTGO_QDRANT_COLLECTION;
  const embeddingUrl = env.CONTEXTGO_EMBEDDING_URL;
  const embeddingApiKey = env.CONTEXTGO_EMBEDDING_API_KEY;
  const embeddingModel = env.CONTEXTGO_EMBEDDING_MODEL;

  if (!qdrantUrl || !qdrantCollection || !embeddingUrl || !embeddingApiKey || !embeddingModel) {
    return undefined;
  }

  return createVectorIndexProvider({
    kind: 'qdrant',
    qdrant: {
      url: qdrantUrl,
      apiKey: env.CONTEXTGO_QDRANT_API_KEY,
      collection: qdrantCollection,
    },
    embedding: {
      baseUrl: embeddingUrl,
      apiKey: embeddingApiKey,
      model: embeddingModel,
      ...(env.CONTEXTGO_EMBEDDING_DIMENSIONS ? { dimensions: Number(env.CONTEXTGO_EMBEDDING_DIMENSIONS) } : {}),
    },
  });
}
