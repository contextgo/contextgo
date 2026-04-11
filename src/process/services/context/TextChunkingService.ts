/**
 * @license
 * Copyright 2025 ContextGo (contextgo.io)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'node:crypto';
import type { ChunkRecord, ContextTier } from '../../../../packages/context-engine/src/domain';

export type TextChunkingConfig = {
  targetTokens?: number;
  overlapTokens?: number;
  minTokens?: number;
};

export type BuildChunksInput = {
  spaceId: string;
  documentId: string;
  content: string;
  tier: ContextTier;
  config?: TextChunkingConfig;
};

const DEFAULT_TARGET_TOKENS = 220;
const DEFAULT_OVERLAP_TOKENS = 40;
const DEFAULT_MIN_TOKENS = 40;

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function splitParagraphs(content: string): string[] {
  return content
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitLongParagraph(paragraph: string): string[] {
  const matches = paragraph.match(/[^.!?。！？]+[.!?。！？]?/g);
  if (!matches) {
    return [];
  }

  return matches.map((part) => part.trim()).filter(Boolean);
}

function hashContent(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

function buildChunkFromSegments(params: {
  spaceId: string;
  documentId: string;
  tier: ContextTier;
  sequence: number;
  segments: readonly string[];
}): ChunkRecord {
  const text = params.segments.join('\n\n').trim();
  return {
    id: createId('chunk'),
    spaceId: params.spaceId,
    documentId: params.documentId,
    sequence: params.sequence,
    text,
    tokenCount: estimateTokens(text),
    contentHash: hashContent(text),
    tier: params.tier,
  };
}

export class TextChunkingService {
  buildChunks(input: BuildChunksInput): ChunkRecord[] {
    const targetTokens = input.config?.targetTokens ?? DEFAULT_TARGET_TOKENS;
    const overlapTokens = input.config?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
    const minTokens = input.config?.minTokens ?? DEFAULT_MIN_TOKENS;
    const paragraphs = splitParagraphs(input.content).flatMap((paragraph) => {
      return estimateTokens(paragraph) > targetTokens * 1.4 ? splitLongParagraph(paragraph) : [paragraph];
    });

    if (paragraphs.length === 0) {
      return [];
    }

    const chunks: ChunkRecord[] = [];
    let currentSegments: string[] = [];
    let currentTokens = 0;
    let sequence = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = estimateTokens(paragraph);
      const wouldOverflow = currentTokens > 0 && currentTokens + paragraphTokens > targetTokens;

      if (wouldOverflow) {
        chunks.push(
          buildChunkFromSegments({
            spaceId: input.spaceId,
            documentId: input.documentId,
            tier: input.tier,
            sequence,
            segments: currentSegments,
          })
        );
        sequence += 1;

        const overlapSegments: string[] = [];
        let overlapTokenCount = 0;
        for (let index = currentSegments.length - 1; index >= 0; index -= 1) {
          const segment = currentSegments[index];
          const segmentTokens = estimateTokens(segment);
          if (overlapTokenCount + segmentTokens > overlapTokens && overlapSegments.length > 0) {
            break;
          }
          overlapSegments.unshift(segment);
          overlapTokenCount += segmentTokens;
        }

        currentSegments = overlapSegments;
        currentTokens = overlapTokenCount;
      }

      currentSegments.push(paragraph);
      currentTokens += paragraphTokens;
    }

    if (currentSegments.length > 0) {
      const finalChunk = buildChunkFromSegments({
        spaceId: input.spaceId,
        documentId: input.documentId,
        tier: input.tier,
        sequence,
        segments: currentSegments,
      });
      if (finalChunk.tokenCount < minTokens && chunks.length > 0) {
        const previous = chunks[chunks.length - 1];
        chunks[chunks.length - 1] = {
          ...previous,
          text: `${previous.text}\n\n${finalChunk.text}`,
          tokenCount: estimateTokens(`${previous.text}\n\n${finalChunk.text}`),
          contentHash: hashContent(`${previous.text}\n\n${finalChunk.text}`),
        };
      } else {
        chunks.push(finalChunk);
      }
    }

    return chunks;
  }
}
