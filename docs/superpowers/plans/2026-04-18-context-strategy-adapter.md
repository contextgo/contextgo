# Context Strategy Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a runtime-neutral External Memory Strategy Adapter SPI to `@contextgo/context-engine` so future Honcho/Mem0/Supermemory-style integrations become adapter work instead of runtime surgery.

**Architecture:** Keep the adapter surface inside `packages/context-engine` as a typed descriptor/registry contract that composes with the existing Context Engine ownership model. Export the SPI from the package root, prove the shape with unit coverage in the existing `policies.test.ts`, and update the runtime-neutral package docs so adapter declarations stay separate from workspace/runtime projections.

**Tech Stack:** TypeScript, Vitest, Bun, Markdown docs

---

### Task 1: Add the External Memory Strategy Adapter Contract

**Files:**

- Create: `packages/context-engine/src/strategyAdapters.ts`
- Modify: `packages/context-engine/src/index.ts`
- Test: `tests/unit/context-engine/policies.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import {
  defineExternalMemoryStrategyAdapter,
  type ExternalMemoryStrategyAdapterDescriptor,
} from '../../../packages/context-engine/src/index';

it('defines a runtime-neutral strategy adapter descriptor with explicit capability metadata', () => {
  const descriptor = defineExternalMemoryStrategyAdapter({
    id: 'mem0-compatible',
    version: '1.0.0',
    displayName: 'Mem0 Compatible Strategy',
    governanceScopes: ['session_steward', 'project_curator'],
    lifecycle: {
      writeMode: 'async',
      recallMode: 'hybrid',
      latencyClass: 'remote',
      costClass: 'llm_dependent',
    },
    capabilities: {
      profile: true,
      search: true,
      reflect: false,
      graph: false,
      conclude: true,
      prefetch: false,
      trustScore: true,
      toolSurface: 'optional',
    },
    config: {
      schemaRef: 'contextgo://strategy-adapters/mem0-compatible',
      secretKeys: ['apiKey'],
      supportsWorkspaceOverrides: true,
    },
    safety: {
      durableWrites: true,
      sideEffects: 'external-memory-write',
      approval: 'workspace-policy',
    },
  });

  expect(descriptor.id).toBe('mem0-compatible');
  expect(descriptor.capabilities.search).toBe(true);
  expect(descriptor.lifecycle.recallMode).toBe('hybrid');
  expect(descriptor.safety.approval).toBe('workspace-policy');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/context-engine/policies.test.ts`
Expected: FAIL because `defineExternalMemoryStrategyAdapter` and the adapter descriptor types do not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type ExternalMemoryStrategyGovernanceScope = 'session_steward' | 'project_curator' | 'space_curator';

export type ExternalMemoryStrategyLifecycle = {
  writeMode: 'sync' | 'async' | 'session_end' | 'batch';
  recallMode: 'auto_inject' | 'tools_only' | 'hybrid';
  latencyClass: 'local' | 'remote';
  costClass: 'cheap' | 'expensive' | 'llm_dependent';
};

export type ExternalMemoryStrategyAdapterDescriptor = {
  id: string;
  version: string;
  displayName: string;
  governanceScopes: readonly ExternalMemoryStrategyGovernanceScope[];
  lifecycle: ExternalMemoryStrategyLifecycle;
  capabilities: {
    profile: boolean;
    search: boolean;
    reflect: boolean;
    graph: boolean;
    conclude: boolean;
    prefetch: boolean;
    trustScore: boolean;
    toolSurface: 'none' | 'optional' | 'required';
  };
  config: {
    schemaRef: string;
    secretKeys: readonly string[];
    supportsWorkspaceOverrides: boolean;
  };
  safety: {
    durableWrites: boolean;
    sideEffects: 'none' | 'external-memory-write' | 'connector-sync';
    approval: 'none' | 'workspace-policy' | 'human-review';
  };
};

export function defineExternalMemoryStrategyAdapter(
  descriptor: ExternalMemoryStrategyAdapterDescriptor
): ExternalMemoryStrategyAdapterDescriptor {
  return descriptor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/unit/context-engine/policies.test.ts`
Expected: PASS with the new adapter descriptor contract exported from the package root.

- [ ] **Step 5: Commit**

```bash
git add packages/context-engine/src/strategyAdapters.ts packages/context-engine/src/index.ts tests/unit/context-engine/policies.test.ts
git commit -m "feat(context): add strategy adapter SPI contracts"
```

### Task 2: Encode Runtime Composition and Safety Boundaries

**Files:**

- Modify: `packages/context-engine/src/strategyAdapters.ts`
- Modify: `packages/context-engine/src/contracts.ts`
- Test: `tests/unit/context-engine/policies.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import type {
  ContextEngineExternalMemorySelection,
  ExternalMemoryStrategyAdapterDescriptor,
} from '../../../packages/context-engine/src/index';

it('composes an adapter selection with existing context-engine ownership without redefining runtime state', () => {
  const selection: ContextEngineExternalMemorySelection = {
    adapterId: 'honcho-compatible',
    enabled: true,
    activeScopes: ['session_steward', 'space_curator'],
    mountedToolsOnly: false,
  };

  expect(selection.activeScopes).toEqual(['session_steward', 'space_curator']);
  expect(selection.mountedToolsOnly).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/context-engine/policies.test.ts`
Expected: FAIL because the Context Engine contracts do not expose a composition type for active strategy adapters.

- [ ] **Step 3: Write minimal implementation**

```ts
export type ContextEngineExternalMemorySelection = {
  adapterId: string;
  enabled: boolean;
  activeScopes: readonly ExternalMemoryStrategyGovernanceScope[];
  mountedToolsOnly: boolean;
};

export type ContextEngineDependencies = {
  sources: ContextSourceStore;
  documents: DocumentSnapshotStore;
  chunks: ChunkStore;
  memories: MemoryStore;
  candidates: MemoryCandidateStore;
  profiles: ProfileStore;
  operations: OperationLogStore;
  policies: ContextEnginePolicySet;
  vectorIndex?: VectorIndexProvider;
  externalMemory?: ContextEngineExternalMemorySelection;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- tests/unit/context-engine/policies.test.ts`
Expected: PASS with a typed composition surface that augments, rather than replaces, current Context Engine ownership.

- [ ] **Step 5: Commit**

```bash
git add packages/context-engine/src/strategyAdapters.ts packages/context-engine/src/contracts.ts tests/unit/context-engine/policies.test.ts
git commit -m "refactor(context): compose external memory adapters with engine contracts"
```

### Task 3: Document the Runtime-Neutral Boundary and Re-Verify

**Files:**

- Modify: `docs/tech/agent-package-architecture.md`
- Modify: `docs/conventions/runtime-support.md`
- Test: `tests/unit/context-engine/policies.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('keeps strategy adapter descriptors runtime-neutral and projection-free', () => {
  const descriptor = defineExternalMemoryStrategyAdapter({
    id: 'supermemory-compatible',
    version: '1.0.0',
    displayName: 'Supermemory Compatible Strategy',
    governanceScopes: ['project_curator'],
    lifecycle: {
      writeMode: 'batch',
      recallMode: 'tools_only',
      latencyClass: 'remote',
      costClass: 'expensive',
    },
    capabilities: {
      profile: false,
      search: true,
      reflect: true,
      graph: true,
      conclude: false,
      prefetch: true,
      trustScore: false,
      toolSurface: 'required',
    },
    config: {
      schemaRef: 'contextgo://strategy-adapters/supermemory-compatible',
      secretKeys: ['apiKey'],
      supportsWorkspaceOverrides: false,
    },
    safety: {
      durableWrites: false,
      sideEffects: 'none',
      approval: 'human-review',
    },
  });

  expect('runtime' in descriptor).toBe(false);
  expect('projectionTarget' in descriptor).toBe(false);
  expect(descriptor.config.schemaRef.startsWith('contextgo://strategy-adapters/')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- tests/unit/context-engine/policies.test.ts`
Expected: FAIL until the descriptor shape and docs are aligned around runtime-neutral adapter declarations.

- [ ] **Step 3: Write minimal implementation**

```md
## External Memory Strategy Adapter Compatibility

Agent Packages may declare compatibility with Context Engine external memory strategy adapters, but those adapter declarations remain runtime-neutral package metadata.

- adapter capability matrices belong to package/context contracts, not runtime-native directories
- secrets and config schema references are declared abstractly and resolved by ContextGo-owned policy/config layers
- `.codex/`, `.claude/`, `.gemini/`, and similar runtime projections must not become the source of truth for strategy-adapter state
```

- [ ] **Step 4: Run test and verification to verify it passes**

Run: `bun run test -- tests/unit/context-engine/policies.test.ts && bunx tsc --noEmit && bun run test`
Expected: PASS for the focused test, typecheck, and full suite with the docs reflecting the same runtime-neutral boundary as the new SPI.

- [ ] **Step 5: Commit**

```bash
git add docs/tech/agent-package-architecture.md docs/conventions/runtime-support.md tests/unit/context-engine/policies.test.ts
git commit -m "docs(context): define runtime-neutral strategy adapter boundary"
```
