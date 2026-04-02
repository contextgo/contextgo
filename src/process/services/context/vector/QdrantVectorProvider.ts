/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  VectorIndexDocument,
  VectorIndexProvider,
  VectorSearchHit,
  VectorSearchInput,
} from '../../../../../packages/context-engine/src/vectorIndex';
import type { EmbeddingProvider } from './OpenAICompatibleEmbeddingProvider';

export type QdrantVectorProviderConfig = {
  url: string;
  apiKey?: string;
  collection: string;
};

export class QdrantVectorProvider implements VectorIndexProvider {
  constructor(
    private readonly config: QdrantVectorProviderConfig,
    private readonly embeddings: EmbeddingProvider
  ) {}

  async upsert(documents: readonly VectorIndexDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    const vectors = await this.embeddings.embedTexts(documents.map((document) => document.text));
    await this.request(`/collections/${this.config.collection}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({
        points: documents.map((document, index) => ({
          id: document.id,
          vector: vectors[index],
          payload: {
            entityId: document.entityId,
            kind: document.kind,
            spaceId: document.spaceId,
            threadId: document.threadId ?? null,
            tier: document.tier,
            ...(document.metadata ?? {}),
          },
        })),
      }),
    });
  }

  async deleteByEntityIds(entityIds: readonly string[]): Promise<void> {
    if (entityIds.length === 0) {
      return;
    }

    await this.request(`/collections/${this.config.collection}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          must: [
            {
              key: 'entityId',
              match: {
                any: [...entityIds],
              },
            },
          ],
        },
      }),
    });
  }

  async search(input: VectorSearchInput): Promise<readonly VectorSearchHit[]> {
    const vector = await this.embeddings.embedQuery(input.query);
    const must: Array<Record<string, unknown>> = [{ key: 'spaceId', match: { value: input.spaceId } }];

    if (input.threadId) {
      must.push({
        key: 'threadId',
        match: { value: input.threadId },
      });
    }
    if (input.kinds && input.kinds.length > 0) {
      must.push({
        key: 'kind',
        match: { any: [...input.kinds] },
      });
    }
    if (input.tiers && input.tiers.length > 0) {
      must.push({
        key: 'tier',
        match: { any: [...input.tiers] },
      });
    }

    const payload = (await this.request(`/collections/${this.config.collection}/points/search`, {
      method: 'POST',
      body: JSON.stringify({
        vector,
        limit: input.topK,
        with_payload: true,
        filter: { must },
      }),
    })) as {
      result?: Array<{
        id: string;
        score: number;
        payload?: Record<string, unknown>;
      }>;
    };

    return (payload.result ?? []).map((item) => ({
      id: String(item.id),
      entityId: String(item.payload?.entityId ?? item.id),
      kind: String(item.payload?.kind ?? 'memory') as VectorSearchHit['kind'],
      score: item.score,
      tier: String(item.payload?.tier ?? 'source') as VectorSearchHit['tier'],
      metadata: item.payload as Record<string, string | number | boolean> | undefined,
    }));
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await fetch(`${this.config.url.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { 'api-key': this.config.apiKey } : {}),
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Qdrant request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}
