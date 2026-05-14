import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AionUIDatabase } from '../../../src/process/services/database';
import { createSqliteContextEngineDependencies } from '../../../src/process/services/database/context/SqliteContextStores';
import { ContextServiceImpl } from '../../../src/process/services/context/ContextServiceImpl';
import type { MemoryEntry, ProfileSegment, SourceRecord } from '../../../packages/context-engine/src/domain';

const databaseState = {
  sources: new Map<string, SourceRecord>(),
  memories: new Map<string, MemoryEntry>(),
  profiles: new Map<string, ProfileSegment>(),
  operations: [] as { id: string; createdAt: string }[],
};

const mockDatabase = {
  getContextSource: vi.fn((id: string) => ({ success: true, data: databaseState.sources.get(id) ?? null })),
  listContextSourcesBySpace: vi.fn((spaceId: string) => ({
    success: true,
    data: [...databaseState.sources.values()].filter((item) => item.spaceId === spaceId),
  })),
  upsertContextSource: vi.fn((source: SourceRecord) => {
    databaseState.sources.set(source.id, source);
    return { success: true, data: source };
  }),
  getContextDocument: vi.fn(() => ({ success: true, data: null })),
  listContextDocumentsBySpace: vi.fn(() => ({ success: true, data: [] })),
  saveContextDocument: vi.fn((snapshot: unknown) => ({ success: true, data: snapshot })),
  listContextChunksByDocument: vi.fn(() => ({ success: true, data: [] })),
  saveContextChunks: vi.fn((chunks: unknown[]) => ({ success: true, data: chunks.length })),
  getContextMemory: vi.fn((id: string) => ({ success: true, data: databaseState.memories.get(id) ?? null })),
  listContextMemoriesBySpace: vi.fn((spaceId: string) => ({
    success: true,
    data: [...databaseState.memories.values()].filter((item) => item.spaceId === spaceId),
  })),
  saveContextMemory: vi.fn((memory: MemoryEntry) => {
    databaseState.memories.set(memory.id, memory);
    return { success: true, data: memory };
  }),
  getContextProfile: vi.fn((id: string) => ({ success: true, data: databaseState.profiles.get(id) ?? null })),
  listContextProfilesBySpace: vi.fn((spaceId: string) => ({
    success: true,
    data: [...databaseState.profiles.values()].filter((item) => item.spaceId === spaceId),
  })),
  saveContextProfile: vi.fn((profile: ProfileSegment) => {
    databaseState.profiles.set(profile.id, profile);
    return { success: true, data: profile };
  }),
  appendContextOperation: vi.fn((operation: { id: string; createdAt: string }) => {
    databaseState.operations.push(operation);
    return { success: true, data: operation };
  }),
  listContextOperations: vi.fn(() => ({ success: true, data: [] })),
  getLatestContextOperationCursor: vi.fn(() => {
    const latest = databaseState.operations.at(-1);
    return {
      success: true,
      data: latest ? { operationId: latest.id, createdAt: latest.createdAt } : null,
    };
  }),
} satisfies Partial<AionUIDatabase>;

vi.mock('@process/services/database', () => ({
  getDatabase: vi.fn(async () => mockDatabase),
}));

describe('Sqlite context stores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    databaseState.sources.clear();
    databaseState.memories.clear();
    databaseState.profiles.clear();
    databaseState.operations.length = 0;
  });

  it('delegates store operations to database methods', async () => {
    const dependencies = createSqliteContextEngineDependencies();
    const source: SourceRecord = {
      id: 'source-1',
      spaceId: 'space-1',
      kind: 'manual-note',
      title: 'Debug note',
      tags: [],
      status: 'active',
      createdAt: '2026-03-30T00:00:00.000Z',
      updatedAt: '2026-03-30T00:00:00.000Z',
    };

    await dependencies.sources.upsert(source);
    const listed = await dependencies.sources.listBySpace('space-1');

    expect(mockDatabase.upsertContextSource).toHaveBeenCalledWith(source);
    expect(listed).toEqual([source]);
  });

  it('wires ContextServiceImpl to sqlite-backed stores by default', async () => {
    const memory: MemoryEntry = {
      id: 'memory-1',
      spaceId: 'space-1',
      kind: 'workflow',
      summary: 'Use a test-first loop for debugging.',
      sourceIds: [],
      chunkIds: [],
      confidence: 0.9,
      tier: 'experiential',
      priority: 'high',
      state: 'accepted',
      createdAt: '2026-03-30T00:00:00.000Z',
      updatedAt: '2026-03-30T00:00:00.000Z',
    };
    databaseState.memories.set(memory.id, memory);

    const service = new ContextServiceImpl();
    const ingest = await service.ingestSource({
      spaceId: 'space-1',
      kind: 'manual-note',
      title: 'RFC debug notes',
      rawContentRef: 'file:///tmp/debug.md',
    });
    const retrieval = await service.retrieve({
      spaceId: 'space-1',
      query: 'debugging loop',
      budgetTokens: 300,
    });

    expect(ingest.source.id).toMatch(/^source-/);
    expect(mockDatabase.saveContextDocument).toHaveBeenCalledTimes(1);
    expect(mockDatabase.appendContextOperation).toHaveBeenCalled();
    expect(retrieval.memories.map((item) => item.memory.id)).toContain('memory-1');
  });
});
