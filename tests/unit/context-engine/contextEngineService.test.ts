import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
import { ProjectContextMirrorService } from '../../../src/process/services/space/ProjectContextMirrorService';

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

function makeProjectTaggedSource(id: string, title: string, projectSlug: string): SourceRecord {
  return {
    ...makeSource(id, title),
    tags: ['engineering', `project:${projectSlug}`],
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

async function writeTestDocument(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
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

  it('baseline[R1]: retrieves accepted memories and matching profiles for a query', async () => {
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
    expect(result.trace).toEqual(
      expect.objectContaining({
        query: 'How should I debug Vitest failures?',
        searchMode: 'hybrid',
        entries: expect.arrayContaining([
          expect.objectContaining({
            entityKind: 'memory',
            entityId: 'memory-1',
            reasons: expect.arrayContaining([
              expect.objectContaining({
                kind: 'lexical_match',
                matchedTerms: expect.arrayContaining(['vitest']),
              }),
            ]),
          }),
          expect.objectContaining({
            entityKind: 'profile',
            entityId: 'profile-1',
            reasons: expect.arrayContaining([
              expect.objectContaining({
                kind: 'profile_memory_link',
                memoryIds: ['memory-1'],
              }),
            ]),
          }),
          expect.objectContaining({
            entityKind: 'source',
            entityId: 'source-1',
            reasons: expect.arrayContaining([
              expect.objectContaining({
                kind: 'source_memory_link',
                memoryIds: ['memory-1'],
              }),
            ]),
          }),
        ]),
      })
    );
  });

  it('baseline[A1]: assembles a task-scoped context pack and omits lower-priority sections beyond budget', async () => {
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
      overlays: {
        threadSummary: 'Current task: fix the flaky Vitest suite before release.',
        pinnedInstructions: ['Prefer surgical changes and keep tool output concise.'],
      },
    });

    expect(result.pack.sections[0]?.kind).toBe('instruction');
    expect(result.pack.sections.some((item) => item.kind === 'thread-state')).toBe(true);
    expect(result.omittedEntityIds.length).toBeGreaterThan(0);
    expect(result.pack.provenance.memoryIds).toContain('memory-1');
    expect(result.trace).toEqual(
      expect.objectContaining({
        budgetTokens: 35,
        spentTokens: expect.any(Number),
        entries: expect.arrayContaining([
          expect.objectContaining({
            sectionKind: 'instruction',
            source: 'pinned_instruction',
            outcome: 'kept',
          }),
          expect.objectContaining({
            sectionKind: 'thread-state',
            source: 'thread_summary',
            outcome: 'kept',
          }),
          expect.objectContaining({
            outcome: 'omitted',
            omissionReason: 'budget',
          }),
        ]),
      })
    );
    expect(result.trace.spentTokens).toBeLessThanOrEqual(35);
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
    expect(result.trace.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityKind: 'memory',
          entityId: 'memory-1',
          reasons: expect.arrayContaining([
            expect.objectContaining({
              kind: 'vector_match',
              hitCount: 1,
            }),
          ]),
        }),
        expect.objectContaining({
          entityKind: 'chunk',
          entityId: 'chunk-1',
          reasons: expect.arrayContaining([
            expect.objectContaining({
              kind: 'vector_match',
              hitCount: 1,
            }),
          ]),
        }),
      ])
    );
  });

  it('boosts same-project vector hits when projectSlug is provided', async () => {
    const vectorIndex = new InMemoryVectorIndexProvider();
    await vectorIndex.upsert([
      {
        id: 'vec-chunk-project-a',
        entityId: 'chunk-project-a',
        kind: 'chunk',
        spaceId: SPACE_ID,
        tier: 'source',
        text: 'release checklist and rollout guardrails',
        metadata: {
          projectSlug: 'project-a',
        },
      },
      {
        id: 'vec-chunk-project-b',
        entityId: 'chunk-project-b',
        kind: 'chunk',
        spaceId: SPACE_ID,
        tier: 'source',
        text: 'release checklist and rollout guardrails',
        metadata: {
          projectSlug: 'project-b',
        },
      },
    ]);

    const dependencies = createInMemoryContextEngineDependencies({
      vectorIndex,
      sources: [
        makeProjectTaggedSource('source-project-a', 'Project A Guide', 'project-a'),
        makeProjectTaggedSource('source-project-b', 'Project B Guide', 'project-b'),
      ],
      documents: [
        {
          id: 'doc-project-a',
          spaceId: SPACE_ID,
          sourceId: 'source-project-a',
          mimeType: 'text/markdown',
          storageUri: 'file:///tmp/project-a.md',
          checksum: 'doc-project-a-hash',
          tokenCount: 80,
          status: 'active',
          createdAt: '2026-03-30T00:00:00.000Z',
        },
        {
          id: 'doc-project-b',
          spaceId: SPACE_ID,
          sourceId: 'source-project-b',
          mimeType: 'text/markdown',
          storageUri: 'file:///tmp/project-b.md',
          checksum: 'doc-project-b-hash',
          tokenCount: 80,
          status: 'active',
          createdAt: '2026-03-30T00:00:00.000Z',
        },
      ],
      chunks: [
        makeChunk({
          id: 'chunk-project-a',
          documentId: 'doc-project-a',
          text: 'Project A release checklist and rollout guardrails.',
        }),
        makeChunk({
          id: 'chunk-project-b',
          documentId: 'doc-project-b',
          text: 'Project B release checklist and rollout guardrails.',
        }),
      ],
    });
    const service = new ContextEngineService(dependencies);

    const result = await service.retrieve({
      spaceId: SPACE_ID,
      query: 'release checklist guardrails',
      budgetTokens: 400,
      includeChunks: true,
      searchMode: 'vector',
      projectSlug: 'project-a',
    });

    expect(result.chunks[0]?.chunk.id).toBe('chunk-project-a');
    expect(result.trace.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityKind: 'chunk',
          entityId: 'chunk-project-a',
          reasons: expect.arrayContaining([
            expect.objectContaining({
              kind: 'project_affinity',
              projectSlug: 'project-a',
              scoreBoost: 18,
            }),
          ]),
        }),
      ])
    );
  });

  it('keeps mounted assembly overlay sections at the top of the assembled pack', async () => {
    const dependencies = createInMemoryContextEngineDependencies();
    const service = new ContextEngineService(dependencies);

    const result = await service.assemble({
      spaceId: SPACE_ID,
      threadId: 'thread-1',
      retrieval: {
        memories: [],
        chunks: [],
        profiles: [],
        sources: [],
        totalEstimatedTokens: 0,
        trace: {
          query: 'empty assembly retrieval',
          queryTerms: [],
          searchMode: 'hybrid',
          entries: [],
        },
      },
      budgetTokens: 120,
      overlays: {
        mountedSections: [
          {
            kind: 'profile',
            id: 'mounted-project',
            summary: 'Project wiki says to keep diffs minimal.',
            tokenCount: 12,
            priority: 94,
          },
        ],
        mountedProfiles: [
          makeProfile({
            id: 'profile-compact-1',
            summary: 'Session compaction summary for current thread.',
          }),
        ],
      },
    });

    expect(result.pack.sections[0]).toEqual(
      expect.objectContaining({
        id: 'mounted-project',
        kind: 'profile',
      })
    );
  });

  it('records mounted boundary metadata in the assembly trace when runtime provides it', async () => {
    const dependencies = createInMemoryContextEngineDependencies();
    const service = new ContextEngineService(dependencies);

    const result = await service.assemble({
      spaceId: SPACE_ID,
      threadId: 'thread-1',
      retrieval: {
        memories: [],
        chunks: [],
        profiles: [],
        sources: [],
        totalEstimatedTokens: 0,
        trace: {
          query: 'empty assembly retrieval',
          queryTerms: [],
          searchMode: 'hybrid',
          entries: [],
        },
      },
      budgetTokens: 120,
      overlays: {
        mountedSections: [
          {
            kind: 'profile',
            id: 'mounted-project',
            summary: 'Project wiki says to keep diffs minimal.',
            tokenCount: 12,
            priority: 94,
          },
        ],
        mountedProfiles: [
          makeProfile({
            id: 'profile-compact-1',
            summary: 'Session compaction summary for current thread.',
          }),
        ],
        pinnedInstructions: ['Prefer minimal verified diffs.'],
      },
      mountedBoundary: {
        boundaryId: 'mounted-boundary:thread-1:1',
        mode: 'frozen-snapshot',
        refreshPolicy: 'next-turn-rebuild',
        threadSummaryIncluded: false,
        mountedSectionIds: ['mounted-project'],
        mountedProfileIds: ['profile-compact-1'],
        pinnedInstructionIds: ['instruction-0'],
        fences: {
          recapture: 'no-recapture',
          reingest: 'no-reingest',
        },
      },
    });

    expect(result.trace.mountedBoundary).toEqual({
      boundaryId: 'mounted-boundary:thread-1:1',
      mode: 'frozen-snapshot',
      refreshPolicy: 'next-turn-rebuild',
      threadSummaryIncluded: false,
      mountedSectionIds: ['mounted-project'],
      mountedProfileIds: ['profile-compact-1'],
      pinnedInstructionIds: ['instruction-0'],
      fences: {
        recapture: 'no-recapture',
        reingest: 'no-reingest',
      },
    });
  });

  it('skips archived sources and their chunks during retrieval', async () => {
    const dependencies = createInMemoryContextEngineDependencies({
      sources: [
        makeSource('source-active', 'Active project guide'),
        {
          ...makeSource('source-archived', 'Archived project guide'),
          status: 'archived',
        },
      ],
      documents: [
        {
          id: 'doc-active',
          spaceId: SPACE_ID,
          sourceId: 'source-active',
          mimeType: 'text/markdown',
          storageUri: 'file:///tmp/active.md',
          checksum: 'doc-active-hash',
          tokenCount: 40,
          status: 'active',
          createdAt: '2026-03-30T00:00:00.000Z',
        },
        {
          id: 'doc-archived',
          spaceId: SPACE_ID,
          sourceId: 'source-archived',
          mimeType: 'text/markdown',
          storageUri: 'file:///tmp/archived.md',
          checksum: 'doc-archived-hash',
          tokenCount: 40,
          status: 'active',
          createdAt: '2026-03-30T00:00:00.000Z',
        },
      ],
      chunks: [
        makeChunk({
          id: 'chunk-active',
          documentId: 'doc-active',
          text: 'Keep the deployment notes current.',
        }),
        makeChunk({
          id: 'chunk-archived',
          documentId: 'doc-archived',
          text: 'Legacy release checklist that should no longer surface.',
        }),
      ],
    });
    const service = new ContextEngineService(dependencies);

    const result = await service.retrieve({
      spaceId: SPACE_ID,
      query: 'legacy release checklist',
      budgetTokens: 400,
      includeChunks: true,
    });

    expect(result.sources.map((item) => item.id)).not.toContain('source-archived');
    expect(result.chunks.map((item) => item.chunk.id)).toEqual([]);
  });
});

describe('ProjectContextMirrorService', () => {
  it('exposes mirrored project docs as an explicit assembly overlay source', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'contextgo-project-mirror-'));
    const workspacePath = path.join(tempRoot, 'workspace');
    const vaultPath = path.join(tempRoot, 'vault');
    const projectFolder = path.join(vaultPath, 'Projects', 'workspace');

    try {
      await writeTestDocument(
        path.join(projectFolder, '_context', 'baseline.md'),
        '# Baseline\n\nPrefer stable flows.'
      );
      await writeTestDocument(path.join(projectFolder, 'workspace.md'), '# Workspace\n\nKeep diffs minimal.');
      await writeTestDocument(path.join(projectFolder, 'Project Insights.md'), '# Insights\n\nVerify changes locally.');
      await writeTestDocument(path.join(projectFolder, 'Sources', 'AGENTS.md'), '# AGENTS\n\nRead AGENTS.md first.');

      const service = new ProjectContextMirrorService({
        archiveSource: async () => undefined,
        indexTextDocument: async () => ({ snapshot: { id: 'doc-1' }, chunks: [] }),
        ingestSource: async (input) => ({ source: { id: input.sourceId ?? 'source-1' }, chunkIds: [], operations: [] }),
        listSources: async () => [],
      } as any);

      const snapshot = await service.syncProjectContext({
        conversation: {
          extra: {
            workingDirectory: workspacePath,
          },
        } as any,
        spaceId: SPACE_ID,
        vaultPath,
      });

      expect(snapshot?.assemblyOverlaySource).toMatchObject({
        overlaySource: 'project-context-mirror',
        projectSlug: snapshot?.projectSlug,
      });
      expect(snapshot?.assemblyOverlaySource.projectSections.map((section) => section.kind)).toEqual([
        'profile',
        'profile',
        'profile',
      ]);
      expect(snapshot?.assemblyOverlaySource.sourceSections.map((section) => section.kind)).toEqual(['source']);
      expect(snapshot?.assemblyOverlaySource.mountedSections.map((section) => section.kind)).toEqual([
        'profile',
        'profile',
        'profile',
        'source',
      ]);
      expect(service.buildMountedSections(snapshot)).toEqual([
        ...(snapshot?.assemblyOverlaySource.projectSections ?? []),
        ...(snapshot?.assemblyOverlaySource.sourceSections ?? []),
      ]);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('returns no explicit assembly overlay source when no project snapshot exists', () => {
    const service = new ProjectContextMirrorService({
      archiveSource: async () => undefined,
      indexTextDocument: async () => ({ snapshot: { id: 'doc-1' }, chunks: [] }),
      ingestSource: async (input) => ({ source: { id: input.sourceId ?? 'source-1' }, chunkIds: [], operations: [] }),
      listSources: async () => [],
    } as any);

    expect(service.buildAssemblyOverlaySource(undefined)).toBeUndefined();
    expect(service.buildMountedSections(undefined)).toEqual([]);
  });
});
