import { describe, expect, it } from 'vitest';
import {
  CONTEXT_ENGINE_MODULE,
  ContextEngineService,
  createInMemoryContextEngineDependencies,
  splitContextEngineDependencies,
  CONTEXT_ENTITY_FAMILIES,
} from '../../../packages/context-engine/src/index';

describe('context engine language boundary', () => {
  it('exports the current core context object families as stable package language', () => {
    expect(CONTEXT_ENGINE_MODULE.packageName).toBe('@contextgo/context-engine');
    expect(ContextEngineService).toBeTypeOf('function');
    expect(CONTEXT_ENTITY_FAMILIES).toEqual({
      raw: ['SourceRecord', 'DocumentSnapshot'],
      retrieval: ['ChunkRecord'],
      semantic: ['MemoryEntry', 'MemoryCandidateEntry', 'ProfileSegment'],
      assembly: ['ContextPack'],
    });
  });

  it('splits provider-facing dependencies from policy dependencies without changing the combined shape', () => {
    const deps = createInMemoryContextEngineDependencies();
    const split = splitContextEngineDependencies(deps);

    expect(split.provider).toEqual(
      expect.objectContaining({
        sources: expect.any(Object),
        documents: expect.any(Object),
        chunks: expect.any(Object),
        memories: expect.any(Object),
        candidates: expect.any(Object),
        profiles: expect.any(Object),
        operations: expect.any(Object),
      })
    );
    expect(split.policies).toBe(deps.policies);
  });
});
