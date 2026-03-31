import { describe, expect, it } from 'vitest';
import { InMemoryVectorIndexProvider } from '../../../packages/context-engine/src/index';
import {
  createVectorIndexProvider,
  createVectorIndexProviderFromEnv,
} from '../../../src/process/services/context/vector/VectorProviderFactory';

describe('VectorProviderFactory', () => {
  it('creates an in-memory provider for local development mode', () => {
    const provider = createVectorIndexProvider({ kind: 'memory' });
    expect(provider).toBeInstanceOf(InMemoryVectorIndexProvider);
  });

  it('returns undefined when qdrant env config is incomplete', () => {
    const provider = createVectorIndexProviderFromEnv({
      CONTEXTGO_VECTOR_PROVIDER: 'qdrant',
      CONTEXTGO_QDRANT_URL: 'http://localhost:6333',
    });

    expect(provider).toBeUndefined();
  });

  it('builds a qdrant-backed provider when env config is complete', () => {
    const provider = createVectorIndexProviderFromEnv({
      CONTEXTGO_VECTOR_PROVIDER: 'qdrant',
      CONTEXTGO_QDRANT_URL: 'http://localhost:6333',
      CONTEXTGO_QDRANT_COLLECTION: 'contextgo-memory',
      CONTEXTGO_EMBEDDING_URL: 'https://api.openai.com/v1',
      CONTEXTGO_EMBEDDING_API_KEY: 'test-key',
      CONTEXTGO_EMBEDDING_MODEL: 'text-embedding-3-small',
    });

    expect(provider?.constructor.name).toBe('QdrantVectorProvider');
  });
});
