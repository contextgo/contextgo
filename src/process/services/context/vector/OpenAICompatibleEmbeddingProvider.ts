/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

export type OpenAICompatibleEmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimensions?: number;
  headers?: Record<string, string>;
};

export interface EmbeddingProvider {
  embedTexts(texts: readonly string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly config: OpenAICompatibleEmbeddingConfig) {}

  async embedTexts(texts: readonly string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.headers ?? {}),
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
        ...(typeof this.config.dimensions === 'number' ? { dimensions: this.config.dimensions } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
    return (payload.data ?? []).map((item) => item.embedding ?? []);
  }

  async embedQuery(text: string): Promise<number[]> {
    const result = await this.embedTexts([text]);
    return result[0] ?? [];
  }
}
