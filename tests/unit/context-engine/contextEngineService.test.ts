import { describe, expect, it } from 'vitest';
import {
  ContextEngineService,
  InMemoryVectorIndexProvider,
  createInMemoryContextEngineDependencies,
  type ChunkRecord,
  type MemoryEntry,
  type ProfileSegment,
  type SourceRecord,
} from '../../../packages/context-engine/src/index';

const SPACE_ID = 'space-1';

function makeSource(id: string, title: string): SourceRecord {
  return {
    id,
    spaceId: SPACE_ID,
    kind: 'manual-note',
    title,
    tags: ['engineering'],
    status: 'active',
    createdAt: '2026-03-30T00:00:00.000Z',
    updatedAt: '2026-03-30T00:00:00.000Z',
  };
}

function makeMemory(overrides: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'summary'>): MemoryEntry {
  return {
    id: overrides.id,
    spaceId: SPACE_ID,
    kind: 'workflow',
    summary: overrides.summary,
    detail: overrides.detail,
    sourceIds: overrides.sourceIds ?? ['source-1'],
    chunkIds: overrides.chunkIds ?? [],
    confidence: overrides.confidence ?? 0.9,
    tier: overrides.tier ?? 'experiential',
    priority: overrides.priority ?? 'high',
    state: overrides.state ?? 'accepted',
    supersededById: overrides.supersededById,
    expiresAt: overrides.expiresAt,
    lastAccessedAt: overrides.lastAccessedAt,
    lastConfirmedAt: overrides.lastConfirmedAt,
    createdAt: overrides.createdAt ?? '2026-03-30T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-30T00:00:00.000Z',
  };
}

function makeChunk(overrides: Partial<ChunkRecord> & Pick<ChunkRecord, 'id' | 'documentId' | 'text'>): ChunkRecord {
  return {
    id: overrides.id,
    spaceId: SPACE_ID,
    documentId: overrides.documentId,
    sequence: overrides.sequence ?? 0,
    text: overrides.text,
    tokenCount: overrides.tokenCount ?? 20,
    contentHash: overrides.contentHash ?? `${overrides.id}-hash`,
    tier: overrides.tier ?? 'source',
    embeddingKey: overrides.embeddingKey,
  };
}

function makeProfile(overrides: Partial<ProfileSegment> & Pick<ProfileSegment, 'id' | 'summary'>): ProfileSegment {
  return {
    id: overrides.id,
    spaceId: SPACE_ID,
    key: overrides.key ?? 'engineering-style',
    summary: overrides.summary,
    memoryIds: overrides.memoryIds ?? ['memory-1'],
    confidence: overrides.confidence ?? 0.8,
    state: overrides.state ?? 'active',
    createdAt: overrides.createdAt ?? '2026-03-30T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-03-30T00:00:00.000Z',
  };
}

describe('ContextEngineService', () => {
  it('ingests a source and writes source/document operations', async () => {
    const dependencies = createInMemoryContextEngineDependencies();
    const service = new ContextEngineService(dependencies);

    const result = await service.ingestSource({
      spaceId: SPACE_ID,
      kind: 'web-clip',
      title: 'RFC Notes',
      rawContentRef: 'file:///tmp/rfc-notes.md',
      tokenCountEstimate: 120,
    });

    expect(result.source.id).toMatch(/^source-/);
    expect(result.snapshot?.storageUri).toBe('file:///tmp/rfc-notes.md');
    expect(result.operations.map((item) => item.type)).toEqual(['source.ingested', 'document.snapshotted']);

    const latestCursor = await dependencies.operations.getLatestCursor(SPACE_ID);
    expect(latestCursor?.operationId).toBe(result.operations[1]?.id);
  });

  it('retrieves accepted memories and matching profiles for a query', async () => {
    const dependencies = createInMemoryContextEngineDependencies({
      sources: [makeSource('source-1', 'Debugging notes')],
      memories: [
        makeMemory({
          id: 'memory-1',
          summary: 'Use a test-fix loop for flaky Vitest failures',
          detail: 'Start from the smallest failing spec, then widen coverage.',
        }),
        makeMemory({
          id: 'memory-2',
          summary: 'Prepare release screenshots before macOS packaging',
          priority: 'low',
        }),
      ],
      profiles: [
        makeProfile({
          id: 'profile-1',
          summary: 'Engineering preference: start from narrow tests before broad validation.',
          memoryIds: ['memory-1'],
        }),
      ],
    });
    const service = new ContextEngineService(dependencies);

    const result = await service.retrieve({
      spaceId: SPACE_ID,
      query: 'How should I debug Vitest failures?',
      budgetTokens: 600,
    });

    expect(result.memories[0]?.memory.id).toBe('memory-1');
    expect(result.memories[0]?.matchedBy).toContain('vitest');
    expect(result.profiles.map((item) => item.id)).toEqual(['profile-1']);
    expect(result.sources.map((item) => item.id)).toContain('source-1');
    expect(result.chunks).toEqual([]);
    expect(result.totalEstimatedTokens).toBeGreaterThan(0);
  });

  it('assembles a task-scoped context pack and omits lower-priority sections beyond budget', async () => {
    const dependencies = createInMemoryContextEngineDependencies({
      sources: [makeSource('source-1', 'Debugging notes')],
      memories: [
        makeMemory({
          id: 'memory-1',
          summary: 'Always reproduce the failing case before changing production code.',
          detail: 'Use the smallest possible spec and preserve a failing artifact.',
          sourceIds: ['source-1'],
        }),
      ],
      profiles: [
        makeProfile({
          id: 'profile-1',
          summary: 'User prefers test-first debugging and minimal diffs.',
          memoryIds: ['memory-1'],
        }),
      ],
    });
    const service = new ContextEngineService(dependencies);
    const retrieval = await service.retrieve({
      spaceId: SPACE_ID,
      query: 'debug failing tests',
      budgetTokens: 500,
    });

    const result = await service.assemble({
      spaceId: SPACE_ID,
      threadId: 'thread-1',
      retrieval,
      budgetTokens: 35,
      threadSummary: 'Current task: fix the flaky Vitest suite before release.',
      pinnedInstructions: ['Prefer surgical changes and keep tool output concise.'],
    });

    expect(result.pack.sections[0]?.kind).toBe('instruction');
    expect(result.pack.sections.some((item) => item.kind === 'thread-state')).toBe(true);
    expect(result.omittedEntityIds.length).toBeGreaterThan(0);
    expect(result.pack.provenance.memoryIds).toContain('memory-1');
  });

  it('filters memory retrieval by tier when requested', async () => {
    const dependencies = createInMemoryContextEngineDependencies({
      memories: [
        makeMemory({ id: 'memory-1', summary: 'Stable preference: use TypeScript strict mode.', tier: 'factual' }),
        makeMemory({
          id: 'memory-2',
          summary: 'Workflow: start debugging from the narrowest failing test.',
          tier: 'experiential',
        }),
      ],
    });
    const service = new ContextEngineService(dependencies);

    const result = await service.retrieve({
      spaceId: SPACE_ID,
      query: 'debugging test workflow',
      budgetTokens: 400,
      memoryTiers: ['experiential'],
    });

    expect(result.memories.map((item) => item.memory.id)).toEqual(['memory-2']);
  });

  it('supports vector-backed retrieval for memories and chunks', async () => {
    const vectorIndex = new InMemoryVectorIndexProvider();
    await vectorIndex.upsert([
      {
        id: 'vec-memory-1',
        entityId: 'memory-1',
        kind: 'memory',
        spaceId: SPACE_ID,
        tier: 'experiential',
        text: 'rollback deployment pipeline incident playbook',
      },
      {
        id: 'vec-chunk-1',
        entityId: 'chunk-1',
        kind: 'chunk',
        spaceId: SPACE_ID,
        tier: 'source',
        text: 'deployment rollback checklist and production guardrails',
      },
    ]);

    const dependencies = createInMemoryContextEngineDependencies({
      vectorIndex,
      sources: [makeSource('source-1', 'Release runbook')],
      documents: [
        {
          id: 'doc-1',
          spaceId: SPACE_ID,
          sourceId: 'source-1',
          mimeType: 'text/markdown',
          storageUri: 'file:///tmp/release-runbook.md',
          checksum: 'doc-1-hash',
          tokenCount: 120,
          status: 'active',
          createdAt: '2026-03-30T00:00:00.000Z',
        },
      ],
      chunks: [
        makeChunk({
          id: 'chunk-1',
          documentId: 'doc-1',
          text: 'The release runbook contains rollback guardrails and production checks.',
        }),
      ],
      memories: [
        makeMemory({
          id: 'memory-1',
          summary: 'Use the incident response workflow.',
          tier: 'experiential',
        }),
      ],
    });
    const service = new ContextEngineService(dependencies);

    const result = await service.retrieve({
      spaceId: SPACE_ID,
      query: 'deployment rollback checklist',
      budgetTokens: 500,
      includeChunks: true,
      searchMode: 'vector',
    });

    expect(result.memories[0]?.memory.id).toBe('memory-1');
    expect(result.memories[0]?.vectorHits?.[0]?.kind).toBe('memory');
    expect(result.chunks[0]?.chunk.id).toBe('chunk-1');
    expect(result.sources.map((item) => item.id)).toContain('source-1');
  });
});
